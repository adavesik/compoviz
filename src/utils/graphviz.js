import { normalizeToAST } from '../models/normalizeToAST.js';
import { getEffectiveImage, getEffectivePorts, getPrimaryNetwork } from '../models/astQueries.js';
import { MountTypes } from '../models/ComposeAST.js';

/**
 * Escape special characters for Graphviz labels
 */
export const escapeLabel = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '\\n');
};

/**
 * Sanitize node ID for Graphviz (must be alphanumeric + underscore)
 */
const sanitizeId = (str) => {
    if (!str) return 'node';
    return String(str).replace(/[^a-zA-Z0-9]/g, '_');
};

/**
 * Professional semantic color palette
 */
const COLORS = {
    // Tiers
    ingress: { bg: '#be123c', border: '#fda4af', text: '#ffffff' },
    routing: { bg: '#c2410c', border: '#fdba74', text: '#ffffff' },
    application: { bg: '#0369a1', border: '#7dd3fc', text: '#ffffff' },
    persistence: { bg: '#15803d', border: '#86efac', text: '#ffffff' },

    // Components
    network: { bg: '#0f172a', border: '#334155', text: '#94a3b8' },

    // Storage Rail
    volume: { bg: '#b45309', border: '#fbbf24', text: '#ffffff' },
    hostPath: { bg: '#4c1d95', border: '#a78bfa', text: '#ffffff' },
    secret: { bg: '#7e22ce', border: '#d8b4fe', text: '#ffffff' },
    config: { bg: '#0e7490', border: '#67e8f9', text: '#ffffff' },

    // Ports
    port: { bg: '#be123c', border: '#fb7185', text: '#ffffff' },

    // Edges
    edge: {
        network: '#64748b',
        data: '#f59e0b',
        config: '#a78bfa',
        traffic: '#f43f5e',
    }
};

/**
 * Detect if input is already a ComposeAST (has services as array with serviceMap).
 */
function isAST(input) {
    return input && Array.isArray(input.services) && input.serviceMap instanceof Map;
}

/**
 * Generate Graphviz DOT from compose state or AST.
 * Accepts either raw compose state (for backward compat) or a ComposeAST.
 */
export const generateGraphviz = (stateOrAst) => {
    const ast = isAST(stateOrAst) ? stateOrAst : normalizeToAST(stateOrAst);

    if (ast.services.length === 0) {
        return `digraph G { bgcolor="transparent" empty [label="No services"] }`;
    }

    // --- PHASE 1: CLASSIFICATION & DATA PREP (all from AST) ---

    // 1. Classify Services into Functional Zones
    const serviceZones = new Map();
    const serviceTiers = new Map();
    for (const service of ast.services) {
        const tier = service.classification.tier;
        serviceTiers.set(service.id, tier);

        if (tier === 'persistence') serviceZones.set(service.id, 'persistence');
        else if (tier === 'routing') serviceZones.set(service.id, 'gateway');
        else serviceZones.set(service.id, 'compute');
    }

    // 2. Collect Ports (Ingress Zone) — already parsed in AST
    const allPorts = [];
    for (const service of ast.services) {
        const ports = getEffectivePorts(service);
        ports.forEach((port, idx) => {
            allPorts.push({
                id: `port_${sanitizeId(service.id)}_${idx}`,
                label: String(port.hostPort),
                protocol: port.protocol,
                serviceId: sanitizeId(service.id),
            });
        });
    }

    // 3. Collect Storage (Storage Sidecar Zone)
    const storageNodes = [];

    // Named volumes
    for (const vol of ast.volumes) {
        storageNodes.push({ id: `vol_${sanitizeId(vol.id)}`, type: 'volume', label: vol.id });
    }

    // Host paths (bind mounts from services)
    const hostPaths = new Map();
    for (const service of ast.services) {
        for (const vol of service.volumes) {
            if (vol.type === MountTypes.BIND && vol.source) {
                const src = vol.source;
                const shortPath = src.length > 20 ? '...' + src.slice(-17) : src;
                const bsId = btoa(src).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                const id = `hp_${bsId.substring(0, 10)}`;
                if (!hostPaths.has(id)) {
                    hostPaths.set(id, { id, type: 'hostPath', label: shortPath });
                    storageNodes.push({ id, type: 'hostPath', label: shortPath });
                }
            }
        }
    }

    // Secrets & Configs
    for (const sec of ast.secrets) {
        storageNodes.push({ id: `sec_${sanitizeId(sec.id)}`, type: 'secret', label: sec.id });
    }
    for (const cfg of ast.configs) {
        storageNodes.push({ id: `cfg_${sanitizeId(cfg.id)}`, type: 'config', label: cfg.id });
    }

    // --- PHASE 2: DOT GENERATION ---

    let dot = `digraph G {\n`;
    dot += `  bgcolor="transparent"\n`;
    dot += `  rankdir=LR\n`;
    dot += `  nodesep=0.6\n`;
    dot += `  ranksep=1.2\n`;
    dot += `  splines=ortho\n`;
    dot += `  fontname="Inter"\n`;
    dot += `  fontsize=10\n`;
    dot += `  node [fontname="Inter", fontsize=10, style="filled,rounded", shape=box, penwidth=1.5, fixedsize=false, margin="0.2,0.1"]\n`;
    dot += `  edge [fontname="Inter", fontsize=9, penwidth=1.5, arrowsize=0.8]\n`;
    dot += `  compound=true\n`;
    dot += `  newrank=true\n\n`;

    // ZONE: STORAGE SIDECAR (Far Right)
    if (storageNodes.length > 0) {
        dot += `  subgraph cluster_storage_sidecar {\n`;
        dot += `    label="📦 STORAGE & CONFIG"\n`;
        dot += `    style="dashed,rounded"\n`;
        dot += `    color="#64748b"\n`;
        dot += `    fontcolor="#94a3b8"\n`;
        dot += `    rank=sink\n`;

        const storageIds = [];
        storageNodes.forEach(node => {
            storageIds.push(node.id);
            let color = COLORS.volume;
            let icon = '💾';
            if (node.type === 'hostPath') { color = COLORS.hostPath; icon = '📁'; }
            if (node.type === 'secret') { color = COLORS.secret; icon = '🔐'; }
            if (node.type === 'config') { color = COLORS.config; icon = '⚙️'; }

            dot += `    ${node.id} [\n`;
            dot += `      label="${icon} ${escapeLabel(node.label)}"\n`;
            dot += `      shape=folder, style=filled\n`;
            dot += `      fillcolor="${color.bg}", color="${color.border}", fontcolor="${color.text}"\n`;
            dot += `      width=1.5\n`;
            dot += `    ]\n`;
        });

        dot += `    { rank=same; ${storageIds[0]} }\n`;
        for (let i = 0; i < storageIds.length - 1; i++) {
            dot += `    ${storageIds[i]} -> ${storageIds[i + 1]} [style=invis, weight=10]\n`;
        }
        dot += `  }\n\n`;
    }

    // ZONE: INGRESS RAIL (Far Left)
    if (allPorts.length > 0) {
        dot += `  subgraph cluster_ingress_zone {\n`;
        dot += `    label="⚡ ENTRY"\n`;
        dot += `    style=invis\n`;
        dot += `    rank=source\n`;

        const portIds = [];
        allPorts.forEach(p => {
            portIds.push(p.id);
            dot += `    ${p.id} [\n`;
            dot += `      label="${p.label}"\n`;
            dot += `      shape=circle, width=0.6, fixedsize=true\n`;
            dot += `      fillcolor="${COLORS.port.bg}", color="${COLORS.port.border}", fontcolor="${COLORS.port.text}"\n`;
            dot += `    ]\n`;
        });

        for (let i = 0; i < portIds.length - 1; i++) {
            dot += `    ${portIds[i]} -> ${portIds[i + 1]} [style=invis, weight=10]\n`;
        }
        dot += `  }\n\n`;
    }

    // NETWORK BOUNDARIES (Zones II, III, IV)
    // Group services by primary network
    const servicesByNetwork = new Map();
    for (const service of ast.services) {
        const net = getPrimaryNetwork(service);
        if (!servicesByNetwork.has(net)) servicesByNetwork.set(net, []);
        servicesByNetwork.get(net).push(service);
    }
    // Ensure standalone networks still render
    for (const network of ast.networks) {
        if (!servicesByNetwork.has(network.id)) servicesByNetwork.set(network.id, []);
    }

    for (const [netName, netServices] of servicesByNetwork) {
        dot += `  subgraph cluster_net_${sanitizeId(netName)} {\n`;
        dot += `    label="🌐 ${escapeLabel(netName)}"\n`;
        dot += `    style="filled,rounded"\n`;
        dot += `    color="${COLORS.network.border}"\n`;
        dot += `    fillcolor="#1e293b"\n`;
        dot += `    fontcolor="${COLORS.network.text}"\n`;
        dot += `    margin=16\n\n`;

        const gateways = [];
        const compute = [];
        const persistence = [];

        for (const service of netServices) {
            const zone = serviceZones.get(service.id);
            const tier = serviceTiers.get(service.id);
            const color = COLORS[tier] || COLORS.application;
            const effectiveImage = getEffectiveImage(service);
            const img = effectiveImage ? effectiveImage.split(':')[0] : 'build';
            const icon = service.classification.icon + ' ';

            const nodeDef = `
                ${sanitizeId(service.id)} [
                    label="${icon}${escapeLabel(service.id)}\\n<${escapeLabel(img)}>"
                    fillcolor="${color.bg}" color="${color.border}" fontcolor="${color.text}"
                ]`;

            if (zone === 'gateway') gateways.push(nodeDef);
            else if (zone === 'persistence') persistence.push(nodeDef);
            else compute.push(nodeDef);
        }

        if (gateways.length > 0) {
            dot += `    subgraph cluster_zone_gateway {\n`;
            dot += `      label="" style=invis\n`;
            dot += `      rank=min\n`;
            dot += gateways.join('\n');
            dot += `    }\n`;
        }

        if (compute.length > 0) {
            dot += `    subgraph cluster_zone_compute {\n`;
            dot += `      label="" style=invis\n`;
            dot += compute.join('\n');
            dot += `    }\n`;
        }

        if (persistence.length > 0) {
            dot += `    subgraph cluster_zone_persistence {\n`;
            dot += `      label="" style=invis\n`;
            dot += `      rank=max\n`;
            dot += persistence.join('\n');
            dot += `    }\n`;
        }

        if (netServices.length === 0) {
            const netId = `net_${sanitizeId(netName)}_empty`;
            dot += `    ${netId} [\n`;
            dot += `      label="(empty network)"\n`;
            dot += `      shape=ellipse\n`;
            dot += `      style="filled"\n`;
            dot += `      fillcolor="${COLORS.network.bg}"\n`;
            dot += `      color="${COLORS.network.border}"\n`;
            dot += `      fontcolor="${COLORS.network.text}"\n`;
            dot += `    ]\n`;
        }

        dot += `  }\n`;
    }

    // --- PHASE 3: SEMANTIC ROUTING ---

    // 1. Ingress: Port -> Service
    allPorts.forEach(p => {
        dot += `  ${p.id} -> ${p.serviceId} [\n`;
        dot += `    label="${p.protocol}"\n`;
        dot += `    color="${COLORS.edge.traffic}", fontcolor="${COLORS.edge.traffic}"\n`;
        dot += `    penwidth=2.5\n`;
        dot += `  ]\n`;
    });

    // 2. Dependency edges
    for (const service of ast.services) {
        const srcId = sanitizeId(service.id);

        for (const dep of service.dependencies) {
            if (ast.serviceMap.has(dep.service)) {
                const depId = sanitizeId(dep.service);

                // Only show condition label for non-default conditions
                // (service_started is the default — don't clutter the diagram)
                let label = '';
                if (dep.condition && dep.condition !== 'service_started') {
                    const condition = dep.condition.replace('service_', '');
                    label = `\\n(${escapeLabel(condition)})`;
                }

                dot += `  ${srcId} -> ${depId} [\n`;
                dot += `    label="${label}"\n`;
                dot += `    color="${COLORS.edge.network}", style=solid\n`;
                dot += `    penwidth=1.5\n`;
                dot += `    fontsize=8\n`;
                dot += `    fontcolor="${COLORS.edge.network}"\n`;
                dot += `  ]\n`;
            }
        }
    }

    // 3. Storage Sidecar Mounts
    for (const service of ast.services) {
        const svcId = sanitizeId(service.id);

        // Volume/bind mounts
        for (const vol of service.volumes) {
            let targetId = null;
            if (vol.type === MountTypes.VOLUME && ast.volumeMap.has(vol.source)) {
                targetId = `vol_${sanitizeId(vol.source)}`;
            } else if (vol.type === MountTypes.BIND && vol.source) {
                const bsId = btoa(vol.source).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                targetId = `hp_${bsId.substring(0, 10)}`;
            }

            if (targetId) {
                dot += `  ${svcId} -> ${targetId} [\n`;
                dot += `    style=dashed\n`;
                dot += `    color="${COLORS.edge.data}"\n`;
                dot += `  ]\n`;
            }
        }

        // Secrets
        for (const secretName of service.secrets) {
            if (ast.secrets.some(s => s.id === secretName)) {
                dot += `  ${svcId} -> sec_${sanitizeId(secretName)} [style=dotted, color="${COLORS.edge.config}"]\n`;
            }
        }

        // Configs
        for (const configName of service.configs) {
            if (ast.configs.some(c => c.id === configName)) {
                dot += `  ${svcId} -> cfg_${sanitizeId(configName)} [style=dotted, color="${COLORS.edge.config}"]\n`;
            }
        }
    }

    dot += `}\n`;
    return dot;
};

// ─── Multi-project support ──────────────────────────────────────────────────

export const PROJECT_COLORS = [
    { bg: '#1e3a8a', border: '#3b82f6', name: 'blue' },
    { bg: '#065f46', border: '#10b981', name: 'green' },
    { bg: '#164e63', border: '#06b6d4', name: 'cyan' },
    { bg: '#581c87', border: '#a855f7', name: 'purple' },
];

const SEVERITY_STYLE = {
    error: { fill: '#7f1d1d', border: '#ef4444', edge: '#ef4444' },
    warning: { fill: '#78350f', border: '#f59e0b', edge: '#f59e0b' },
    info: { fill: null, border: null, edge: '#a78bfa' },
};
const SEVERITY_RANK = { error: 3, warning: 2, info: 1 };

const HUB_SHAPES = {
    network: { shape: 'ellipse', fill: '#4c1d95', border: '#a78bfa', prefix: 'net' },
    volume: { shape: 'cylinder', fill: '#78350f', border: '#fbbf24', prefix: 'vol' },
    env_file: { shape: 'note', fill: '#164e63', border: '#67e8f9', prefix: 'env' },
};

/** Categories rendered as direct service-to-service conflict edges. */
const EDGE_CATEGORIES = new Set(['port', 'container_name']);

/** Escape text for Graphviz HTML-like labels (XML rules, no \n handling). */
const escapeHtml = (str) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const MAX_PORT_CHIPS = 4;
const PORT_CHIPS_PER_ROW = 2;
const WILDCARD_HOSTS = new Set(['', '0.0.0.0', '::', '[::]']);

/**
 * Parse a raw compose port entry into display parts.
 * @returns {{ host: string|null, hostIp: string|null, container: string, protocol: string|null } | null}
 */
const describePort = (port) => {
    if (port && typeof port === 'object') {
        const container = String(port.target ?? '');
        if (!container) return null;
        return {
            host: port.published !== undefined && port.published !== '' ? String(port.published) : null,
            hostIp: port.host_ip && !WILDCARD_HOSTS.has(port.host_ip) ? port.host_ip : null,
            container,
            protocol: port.protocol && port.protocol !== 'tcp' ? port.protocol : null,
        };
    }
    const str = String(port ?? '').trim();
    if (!str) return null;
    const protoMatch = str.match(/\/(tcp|udp|sctp)$/i);
    const protocol = protoMatch && protoMatch[1].toLowerCase() !== 'tcp' ? protoMatch[1].toLowerCase() : null;
    const body = protoMatch ? str.slice(0, -protoMatch[0].length) : str;

    let hostIp = null;
    let parts;
    if (body.startsWith('[')) {
        const close = body.indexOf(']');
        hostIp = body.slice(1, close);
        parts = body.slice(close + 2).split(':');
    } else {
        parts = body.split(':');
        if (parts.length === 3) hostIp = parts.shift();
    }
    if (hostIp && WILDCARD_HOSTS.has(hostIp)) hostIp = null;
    if (parts.length === 1) return { host: null, hostIp, container: parts[0], protocol };
    return { host: parts[0], hostIp, container: parts[1], protocol };
};

/** One rounded port "chip" cell. Conflicting ports are solid red. */
const portChip = (desc, conflicting) => {
    const bg = conflicting ? '#dc2626' : '#0b1220';
    const border = conflicting ? '#fecaca' : '#475569';
    const main = conflicting ? '#ffffff' : '#e2e8f0';
    const dim = conflicting ? '#fee2e2' : '#94a3b8';
    const ip = desc.hostIp ? `<FONT COLOR="${dim}">${escapeHtml(desc.hostIp)}:</FONT>` : '';
    const proto = desc.protocol ? `<FONT COLOR="${dim}"> /${escapeHtml(desc.protocol)}</FONT>` : '';
    // Unpublished ports (container-only) are shown with a dimmed "internal" marker
    const text = desc.host
        ? `${ip}<B>${escapeHtml(desc.host)}</B><FONT COLOR="${dim}">:${escapeHtml(desc.container)}</FONT>${proto}`
        : `<FONT COLOR="${dim}">internal </FONT><B>${escapeHtml(desc.container)}</B>${proto}`;
    return `<TD BGCOLOR="${bg}" COLOR="${border}" BORDER="1" STYLE="rounded" CELLPADDING="3">`
        + `<FONT FACE="Courier" POINT-SIZE="9" COLOR="${main}">${text}</FONT></TD>`;
};

/**
 * HTML-like label for a service node: title row with issue badge,
 * image line, then port chips (2 per row, max 4 + overflow counter).
 */
const serviceNodeLabel = ({ name, image, ports, conflictingIndexes, issues, severity }) => {
    const badgeColor = severity === 'warning' ? '#d97706' : '#dc2626';
    const badgeText = `${issues} issue${issues === 1 ? '' : 's'}`;
    // FIXEDSIZE keeps the pill hugging its text: otherwise Graphviz stretches the
    // cell to fill the row. Width is derived from 8pt bold Helvetica (~5.4pt/char).
    const badge = issues > 0
        ? `<TD BGCOLOR="${badgeColor}" STYLE="rounded" FIXEDSIZE="TRUE" WIDTH="${Math.ceil(badgeText.length * 5.4 + 12)}" HEIGHT="15" ALIGN="CENTER">`
          + `<FONT POINT-SIZE="8" COLOR="#ffffff"><B>${badgeText}</B></FONT></TD>`
        : '<TD></TD>';
    // Graphviz measures bold text with regular-weight metrics; trailing spaces keep the
    // name from running under the badge.
    const namePad = '&nbsp;'.repeat(Math.ceil(String(name).length * 0.2) + 2);

    const described = ports
        .map((p, index) => ({ desc: describePort(p), index }))
        .filter(p => p.desc)
        // Show conflicting ports first so they are never hidden by the overflow counter
        .sort((a, b) => Number(conflictingIndexes.has(b.index)) - Number(conflictingIndexes.has(a.index)));
    const shown = described.slice(0, MAX_PORT_CHIPS);
    const hidden = described.length - shown.length;

    let portRows = '';
    for (let i = 0; i < shown.length; i += PORT_CHIPS_PER_ROW) {
        const row = shown.slice(i, i + PORT_CHIPS_PER_ROW)
            .map(p => portChip(p.desc, conflictingIndexes.has(p.index)))
            .join('');
        portRows += `<TR>${row}</TR>`;
    }
    if (hidden > 0) {
        portRows += `<TR><TD COLSPAN="${PORT_CHIPS_PER_ROW}" ALIGN="LEFT"><FONT POINT-SIZE="8" COLOR="#94a3b8">+${hidden} more port${hidden === 1 ? '' : 's'}</FONT></TD></TR>`;
    }
    const portsBlock = portRows
        ? `<TR><TD COLSPAN="2" ALIGN="LEFT"><TABLE BORDER="0" CELLBORDER="0" CELLSPACING="3" CELLPADDING="0">${portRows}</TABLE></TD></TR>`
        : '';

    return '<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="2" CELLPADDING="1">'
        // Title row lives in its own nested table so wide port rows below can't stretch the badge
        + '<TR><TD COLSPAN="2" ALIGN="LEFT"><TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="0"><TR>'
        + `<TD ALIGN="LEFT"><FONT POINT-SIZE="11" COLOR="#ffffff"><B>${escapeHtml(name)}</B>${namePad}</FONT></TD>${badge}`
        + '</TR></TABLE></TD></TR>'
        + `<TR><TD COLSPAN="2" ALIGN="LEFT"><FONT POINT-SIZE="8.5" COLOR="#cbd5e1">${escapeHtml(image)}</FONT></TD></TR>`
        + portsBlock
        + '</TABLE>>';
};

/** Format a port conflict key for an edge badge: wildcard IPs collapse to ":8080". */
const shortBinding = (key) => String(key).replace(/^(0\.0\.0\.0|\[::\]|\*):/, ':');

/**
 * HTML-like label for a conflict node: what is contested (kind), the value,
 * and how many services claim it.
 */
const conflictNodeLabel = (result, serviceCount) => {
    const kind = result.category === 'port' ? 'HOST PORT' : 'CONTAINER NAME';
    const value = result.category === 'port' ? shortBinding(result.key) : result.key;
    return '<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="1" CELLPADDING="0">'
        + `<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="7.5" COLOR="#fca5a5"><B>${kind}</B></FONT></TD></TR>`
        + `<TR><TD ALIGN="LEFT"><FONT FACE="Courier" POINT-SIZE="12" COLOR="#ffffff"><B>${escapeHtml(value)}</B></FONT></TD></TR>`
        + `<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="7.5" COLOR="#fecaca">claimed by ${serviceCount} services</FONT></TD></TR>`
        + '</TABLE>>';
};

const shortImage = (svc) => {
    const img = svc.image ? String(svc.image).split('@')[0].split(':')[0].split('/').pop() : 'build';
    return img.length > 18 ? `${img.slice(0, 15)}…` : img;
};

/**
 * Build the compare-mode diagram.
 *
 * @param {Array} projects - Compare projects ({ id, name, content })
 * @param {Array} results - Comparison results from compareProjects
 * @param {{ dismissed?: string[] }} [options]
 * @returns {{ dot: string, nodeMap: Object<string, {kind:'service', projectId, service} | {kind:'resource', resultId}>, edgeMap: Object<string, string[]>, clusterMap: Object<string, string> }}
 */
export const buildMultiProjectGraph = (projects, results = [], { dismissed = [] } = {}) => {
    const nodeMap = {};
    const edgeMap = {};
    const clusterMap = {};

    if (!projects || projects.length === 0) {
        return { dot: `digraph G { bgcolor="transparent" empty [label="No projects"] }`, nodeMap, edgeMap, clusterMap };
    }

    const dismissedSet = new Set(dismissed);
    const active = results.filter(r => !dismissedSet.has(r.id));

    // service key -> highest severity among active results
    const serviceSeverity = new Map();
    const serviceIssueCount = new Map();
    for (const r of active) {
        if (r.severity === 'info') continue;
        for (const d of Array.isArray(r.details) ? r.details : []) {
            if (!d.service) continue;
            const key = `${d.projectId}::${d.service}`;
            const current = serviceSeverity.get(key);
            if (!current || SEVERITY_RANK[r.severity] > SEVERITY_RANK[current]) serviceSeverity.set(key, r.severity);
            serviceIssueCount.set(key, (serviceIssueCount.get(key) || 0) + 1);
        }
    }
    // service key -> Set of raw port indexes involved in a port conflict
    const conflictingPorts = new Map();
    for (const r of active) {
        if (r.category !== 'port') continue;
        for (const d of Array.isArray(r.details) ? r.details : []) {
            if (!d.service || !Number.isInteger(d.portIndex)) continue;
            const key = `${d.projectId}::${d.service}`;
            if (!conflictingPorts.has(key)) conflictingPorts.set(key, new Set());
            conflictingPorts.get(key).add(d.portIndex);
        }
    }

    const projectNameConflicts = new Set(
        active.filter(r => r.category === 'project_name').flatMap(r => r.projectIds || [])
    );

    const serviceNodeId = new Map(); // `${projectId}::${service}` -> node id

    let dot = 'digraph G {\n';
    dot += '  bgcolor="transparent"\n';
    dot += '  rankdir=LR\n';
    dot += '  nodesep=0.5\n';
    dot += '  ranksep=1.4\n';
    dot += '  splines=true\n';
    dot += '  outputorder=edgesfirst\n';
    // Helvetica/Courier: Graphviz has exact width tables for these, so HTML-label
    // cells are sized to match what the browser renders (it has none for Inter).
    dot += '  fontname="Helvetica"\n';
    dot += '  fontsize=11\n';
    dot += '  pad=0.4\n';
    dot += '  node [fontname="Helvetica", fontsize=10, style="filled,rounded", shape=box, margin="0.22,0.12", penwidth=1.5]\n';
    dot += '  edge [fontname="Helvetica", fontsize=9, arrowsize=0.7]\n';
    dot += '  compound=true\n';
    dot += '  newrank=true\n\n';

    projects.forEach((project, idx) => {
        const content = project.content || {};
        const color = PROJECT_COLORS[idx % PROJECT_COLORS.length];
        const clusterId = `cluster_project_${idx}`;
        clusterMap[clusterId] = project.id;
        const hasNameConflict = projectNameConflicts.has(project.id);

        dot += `  subgraph ${clusterId} {\n`;
        dot += `    id="${clusterId}"\n`;
        dot += `    label="${hasNameConflict ? '⚠ ' : ''}${escapeLabel(project.name || `Project ${idx + 1}`)}${project.modified ? ' •' : ''}"\n`;
        dot += '    labeljust="l"\n';
        dot += '    style="filled,rounded"\n';
        dot += `    color="${hasNameConflict ? SEVERITY_STYLE.error.border : color.border}"\n`;
        dot += `    penwidth=${hasNameConflict ? 2.5 : 1.5}\n`;
        dot += `    fillcolor="${color.bg}26"\n`;
        dot += '    fontcolor="#f1f5f9"\n';
        dot += '    margin=16\n\n';

        const services = Object.entries(content.services || {});
        if (services.length === 0) {
            dot += `    p${idx}_empty [label="(no services)", shape=plaintext, style="", fontcolor="#94a3b8"]\n`;
        }

        services.forEach(([serviceName, svc = {}], sIdx) => {
            const nodeId = `p${idx}_s${sIdx}`;
            const key = `${project.id}::${serviceName}`;
            serviceNodeId.set(key, nodeId);
            nodeMap[nodeId] = { kind: 'service', projectId: project.id, service: serviceName };

            const severity = serviceSeverity.get(key);
            const issues = serviceIssueCount.get(key) || 0;
            const style = severity ? SEVERITY_STYLE[severity] : null;
            const label = serviceNodeLabel({
                name: serviceName,
                image: shortImage(svc),
                ports: Array.isArray(svc.ports) ? svc.ports : [],
                conflictingIndexes: conflictingPorts.get(key) || new Set(),
                issues,
                severity,
            });

            dot += `    ${nodeId} [\n`;
            dot += `      id="${nodeId}"\n`;
            dot += `      label=${label}\n`;
            dot += '      margin="0.12,0.08"\n';
            dot += `      fillcolor="${style?.fill || color.bg}"\n`;
            dot += `      color="${style?.border || color.border}"\n`;
            dot += '      fontcolor="#ffffff"\n';
            dot += `      penwidth=${severity === 'error' ? 3 : severity === 'warning' ? 2.5 : 1.5}\n`;
            dot += '    ]\n';
        });
        dot += '  }\n\n';
    });

    // Shared resources hub (networks / volumes / env files that span projects)
    const hubs = active.filter(r => HUB_SHAPES[r.category]);
    if (hubs.length > 0) {
        dot += '  subgraph cluster_shared {\n';
        dot += '    id="cluster_shared"\n';
        dot += '    label="CROSS-PROJECT RESOURCES"\n';
        dot += '    style="dashed,rounded"\n';
        dot += '    color="#64748b"\n';
        dot += '    fontcolor="#cbd5e1"\n';
        dot += '    margin=16\n';
        let hubEdges = '';
        hubs.forEach((r, hIdx) => {
            const shape = HUB_SHAPES[r.category];
            const hubId = `hub_${shape.prefix}_${hIdx}`;
            nodeMap[hubId] = { kind: 'resource', resultId: r.id };
            const sev = SEVERITY_STYLE[r.severity];
            const isolated = r.type === 'isolated';
            const subtitle = isolated ? 'isolated per project' : r.type === 'conflict' ? 'shared · risky' : 'shared';
            dot += `    ${hubId} [id="${hubId}", label="${escapeLabel(r.key)}\\n${subtitle}", shape=${shape.shape}, `
                + `style="${isolated ? 'filled,dashed' : 'filled'}", fillcolor="${r.severity === 'warning' ? sev.fill : shape.fill}", `
                + `color="${r.severity === 'warning' ? sev.border : shape.border}", fontcolor="#ffffff"] \n`;

            const seen = new Set();
            (Array.isArray(r.details) ? r.details : []).forEach((d, dIdx) => {
                const from = serviceNodeId.get(`${d.projectId}::${d.service}`);
                if (!from || seen.has(from)) return;
                seen.add(from);
                const edgeId = `edge_${hubId}_${dIdx}`;
                edgeMap[edgeId] = [r.id];
                hubEdges += `  ${from} -> ${hubId} [id="${edgeId}", style=${isolated ? 'dotted' : 'dashed'}, `
                    + `color="${r.severity === 'warning' ? sev.edge : shape.border}", arrowhead=none]\n`;
            });
        });
        dot += '  }\n\n';
        dot += hubEdges;
    }

    // Conflicts (host port / container name): each contested value is its own node,
    // and every service that claims it connects to it. Reads as "these services
    // fight over this", with no labels floating on edges.
    const conflicts = active.filter(r => EDGE_CATEGORIES.has(r.category));
    if (conflicts.length > 0) {
        dot += '  subgraph cluster_conflicts {\n';
        dot += '    id="cluster_conflicts"\n';
        dot += '    label="CONFLICTS"\n';
        dot += '    style="dashed,rounded"\n';
        dot += '    color="#ef4444"\n';
        dot += '    fontcolor="#fca5a5"\n';
        dot += '    margin=16\n';
        let conflictEdges = '';
        conflicts.forEach((r, cIdx) => {
            const hubId = `hub_cfl_${cIdx}`;
            nodeMap[hubId] = { kind: 'resource', resultId: r.id };
            const services = [];
            (Array.isArray(r.details) ? r.details : []).forEach(d => {
                const from = serviceNodeId.get(`${d.projectId}::${d.service}`);
                if (from && !services.includes(from)) services.push(from);
            });
            dot += `    ${hubId} [id="${hubId}", shape=box, style="filled,rounded", fillcolor="#450a0a", color="#ef4444", penwidth=2, margin="0.14,0.08", `
                + `label=${conflictNodeLabel(r, services.length)}]\n`;
            services.forEach((from, sIdx) => {
                const edgeId = `edge_conflict_${cIdx}_${sIdx}`;
                edgeMap[edgeId] = [r.id];
                conflictEdges += `  ${from} -> ${hubId} [id="${edgeId}", color="${SEVERITY_STYLE.error.edge}", penwidth=2, arrowhead=none]\n`;
            });
        });
        dot += '  }\n\n';
        dot += conflictEdges;
    }

    dot += '}\n';
    return { dot, nodeMap, edgeMap, clusterMap };
};

/**
 * Backward-compatible wrapper returning only the DOT string.
 */
export const generateMultiProjectGraphviz = (projects, conflicts = [], options) =>
    buildMultiProjectGraph(projects, conflicts, options).dot;
