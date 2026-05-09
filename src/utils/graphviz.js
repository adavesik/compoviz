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
// Note: generateMultiProjectGraphviz still uses raw state for now.
// It will be migrated in Task 6 (compareProjects migration).

const PROJECT_COLORS = [
    { bg: '#1e3a8a', border: '#3b82f6', name: 'blue' },
    { bg: '#065f46', border: '#10b981', name: 'green' },
    { bg: '#164e63', border: '#06b6d4', name: 'cyan' },
];

export const generateMultiProjectGraphviz = (projects, conflicts = []) => {
    if (!projects || projects.length === 0) {
        return `digraph G { bgcolor="transparent" empty [label="No projects"] }`;
    }

    // Build conflict lookup
    const conflictPorts = new Set();
    const conflictContainers = new Set();
    conflicts.forEach(c => {
        if (c.category === 'port' && c.type === 'conflict') {
            c.details?.forEach(d => conflictPorts.add(`${d.project}:${d.service}`));
        }
        if (c.category === 'container_name' && c.type === 'conflict') {
            c.details?.forEach(d => conflictContainers.add(`${d.project}:${d.service}`));
        }
    });

    // Collect shared networks
    const allNetworks = new Map();
    projects.forEach((project, idx) => {
        const content = project.content || {};
        Object.keys(content.networks || {}).forEach(netName => {
            if (!allNetworks.has(netName)) allNetworks.set(netName, []);
            allNetworks.get(netName).push(idx);
        });
    });

    let dot = `digraph G {\n`;
    dot += `  bgcolor="transparent"\n`;
    dot += `  rankdir=LR\n`;
    dot += `  nodesep=0.6\n`;
    dot += `  ranksep=1.0\n`;
    dot += `  splines=ortho\n`;
    dot += `  fontname="Inter"\n`;
    dot += `  fontsize=10\n`;
    dot += `  node [fontname="Inter", fontsize=9, style="filled,rounded", shape=box, margin="0.2,0.12"]\n`;
    dot += `  edge [fontname="Inter", fontsize=8]\n`;
    dot += `  compound=true\n`;
    dot += `  newrank=true\n\n`;

    projects.forEach((project, idx) => {
        const content = project.content || {};
        const projectPrefix = `p${idx}_`;
        const color = PROJECT_COLORS[idx % PROJECT_COLORS.length];

        dot += `  subgraph cluster_project_${idx} {\n`;
        dot += `    label="${escapeLabel(project.name || 'Project ' + (idx + 1))}"\n`;
        dot += `    style="filled,rounded"\n`;
        dot += `    color="${color.border}"\n`;
        dot += `    fillcolor="${color.bg}20"\n`;
        dot += `    fontcolor="#f1f5f9"\n\n`;

        Object.entries(content.services || {}).forEach(([serviceName, svc]) => {
            const nodeId = `${projectPrefix}${sanitizeId(serviceName)}`;
            const img = svc.image ? svc.image.split(':')[0] : 'build';
            const imgShort = img.length > 15 ? img.slice(0, 12) + '...' : img;
            const svcPorts = Array.isArray(svc.ports) ? svc.ports : [];
            const portLabels = svcPorts
                .map((port) => {
                    if (typeof port === 'string') return port;
                    if (port && typeof port === 'object') {
                        const published = port.published || port.target;
                        const target = port.target || port.published;
                        if (!published || !target) return '';
                        return `${published}:${target}`;
                    }
                    return '';
                })
                .filter(Boolean);
            const portsPreview = portLabels.length > 0
                ? `\\n${escapeLabel(portLabels.slice(0, 3).join(', '))}${portLabels.length > 3 ? '…' : ''}`
                : '';

            const serviceKey = `${project.name}:${serviceName}`;
            const hasConflict = conflictPorts.has(serviceKey) || conflictContainers.has(serviceKey);
            const nodeColor = hasConflict ? '#7f1d1d' : color.bg;
            const nodeBorder = hasConflict ? '#ef4444' : color.border;

            dot += `    ${nodeId} [\n`;
            dot += `      label="${escapeLabel(serviceName)}\\n<${escapeLabel(imgShort)}>${portsPreview}"\n`;
            dot += `      fillcolor="${nodeColor}"\n`;
            dot += `      color="${nodeBorder}"\n`;
            dot += `      fontcolor="#ffffff"\n`;
            dot += `      penwidth=${hasConflict ? 3 : 1.5}\n`;
            dot += `    ]\n`;
        });
        dot += `  }\n\n`;
    });

    // Shared networks
    const sharedNumbers = [...allNetworks.entries()].filter(([, projs]) => projs.length > 1);
    if (sharedNumbers.length > 0) {
        dot += `  subgraph cluster_shared {\n`;
        dot += `    label="SHARED NETWORKS"\n`;
        dot += `    style="dashed,rounded"\n`;
        dot += `    color="#a78bfa"\n`;
        dot += `    fontcolor="#f1f5f9"\n`;
        sharedNumbers.forEach(([netName]) => {
            const netId = `shared_net_${sanitizeId(netName)}`;
            dot += `    ${netId} [label="${escapeLabel(netName)}", shape=ellipse, style="filled", fillcolor="#4c1d95", color="#a78bfa", fontcolor="#ffffff"]\n`;
        });
        dot += `  }\n\n`;

        projects.forEach((project, idx) => {
            const content = project.content || {};
            const projectPrefix = `p${idx}_`;
            Object.entries(content.services || {}).forEach(([serviceName, svc]) => {
                const networks = Array.isArray(svc.networks) ? svc.networks : [];
                networks.forEach(netName => {
                    if (allNetworks.get(netName)?.length > 1) {
                        const nodeId = `${projectPrefix}${sanitizeId(serviceName)}`;
                        const netId = `shared_net_${sanitizeId(netName)}`;
                        dot += `  ${nodeId} -> ${netId} [style=dashed, color="#a78bfa"]\n`;
                    }
                });
            });
        });
    }

    dot += `}\n`;
    return dot;
};
