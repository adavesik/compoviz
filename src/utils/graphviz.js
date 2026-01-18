import { normalizeArray } from './validation';
import { getServiceEmoji } from './iconUtils.jsx';

/**
 * Escape special characters for Graphviz labels
 */
/**
 * Get the underlying value from a possibly metadata-wrapped object
 */
const getValue = (val) => {
    if (val && typeof val === 'object' && '_value' in val) {
        return val._value;
    }
    return val;
};

/**
 * Escape special characters for Graphviz labels
 */
export const escapeLabel = (str) => {
    if (!str) return '';
    return String(getValue(str)) // Ensure we unwrap value first
        .replace(/\\/g, '\\\\')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '\\n'); // Support multiline labels
};


/**
 * Extract depends_on condition from long syntax
 */


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
    ingress: { bg: '#be123c', border: '#fda4af', text: '#ffffff' },      // Rose/Red (Input)
    routing: { bg: '#c2410c', border: '#fdba74', text: '#ffffff' },      // Orange/Warm (Proxy)
    application: { bg: '#0369a1', border: '#7dd3fc', text: '#ffffff' },  // Blue/Cool (Logic)
    persistence: { bg: '#15803d', border: '#86efac', text: '#ffffff' },  // Green/Stable (Data)

    // Components
    network: { bg: '#0f172a', border: '#334155', text: '#94a3b8' },      // Dark Slate

    // Storage Rail
    volume: { bg: '#b45309', border: '#fbbf24', text: '#ffffff' },
    hostPath: { bg: '#4c1d95', border: '#a78bfa', text: '#ffffff' },
    secret: { bg: '#7e22ce', border: '#d8b4fe', text: '#ffffff' },
    config: { bg: '#0e7490', border: '#67e8f9', text: '#ffffff' },

    // Ports
    port: { bg: '#be123c', border: '#fb7185', text: '#ffffff' },

    // Edges
    edge: {
        network: '#64748b',   // Neutral/Dark for structure
        data: '#f59e0b',      // Gold for storage
        config: '#a78bfa',    // Lavender for config
        traffic: '#f43f5e',   // Red/Pink for active traffic
    }
};

/**
 * Classify a service into a tier based on its image/name
 */
const classifyServiceTier = (name, svc) => {
    const image = (getValue(svc.image) || '').toLowerCase();
    const serviceName = name.toLowerCase();

    // Database/persistence tier
    const dbPatterns = ['postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'memcached',
        'elasticsearch', 'rabbitmq', 'kafka', 'minio', 'influx', 'consul', 'zoo'];
    if (dbPatterns.some(p => image.includes(p) || serviceName.includes(p))) {
        return 'persistence';
    }

    // Routing tier
    const routingPatterns = ['traefik', 'nginx', 'haproxy', 'caddy', 'envoy', 'kong', 'gateway'];
    if (routingPatterns.some(p => image.includes(p) || serviceName.includes(p))) {
        return 'routing';
    }

    // If service has ports exposed, it might be an entry point or routing
    const ports = normalizeArray(getValue(svc.ports));
    if (ports.length > 0) {
        const hasCommonPorts = ports.some(portRaw => {
            const p = getValue(portRaw);
            const portStr = typeof p === 'string' ? p : String(p.published);
            return ['80', '443', '8080', '8443', '4443'].includes(portStr.split(':')[0]);
        });
        if (hasCommonPorts) return 'routing'; // Assumption: Web ports usually imply routing/web
    }

    return 'application';
};

export const generateGraphviz = (state) => {
    const services = state.services || {};
    const networks = state.networks || {};
    const volumes = state.volumes || {};
    const secrets = state.secrets || {};
    const configs = state.configs || {};

    if (Object.keys(services).length === 0) {
        return `digraph G { bgcolor="transparent" empty [label="No services"] }`;
    }

    // --- PHASE 1: CLASSIFICATION & DATA PREP ---

    // 1. Classify Services into Functional Zones
    const serviceZones = new Map();
    const serviceTiers = new Map(); // Store tier for color lookup
    Object.entries(services).forEach(([name, svc]) => {
        const tier = classifyServiceTier(name, svc);
        serviceTiers.set(name, tier);

        // Map Tiers to Zones
        if (tier === 'persistence') serviceZones.set(name, 'persistence');
        else if (tier === 'routing') serviceZones.set(name, 'gateway');
        else serviceZones.set(name, 'compute');
    });

    // 2. Collect Ports (Ingress Zone)
    const allPorts = [];
    Object.entries(services).forEach(([name, svc]) => {
        normalizeArray(getValue(svc.ports)).forEach((portRaw, idx) => {
            const port = getValue(portRaw);
            let hostPort, protocol;
            if (typeof port === 'string') {
                // Parse string format: supports IPv4, IPv6, and all Docker Compose formats
                let portPart;

                // Handle IPv6 with square brackets: [::1]:8080:80
                if (port.startsWith('[')) {
                    const closeBracket = port.indexOf(']');
                    if (closeBracket !== -1) {
                        const remaining = port.substring(closeBracket + 1);
                        if (remaining.startsWith(':')) {
                            const remainingParts = remaining.substring(1).split(':');
                            // remainingParts = ['8080', '80'] or ['8080'] or ['80']
                            portPart = remainingParts[0];
                        } else {
                            portPart = port; // Fallback
                        }
                    } else {
                        portPart = port; // Invalid but fallback
                    }
                } else {
                    // Handle IPv4 or simple formats
                    const parts = port.split(':');

                    if (parts.length === 2) {
                        // Format: HOST:CONTAINER
                        portPart = parts[0];
                    } else if (parts.length === 3) {
                        // Format: IP:HOST:CONTAINER (IPv4)
                        portPart = parts[1];
                    } else if (parts.length > 3) {
                        // Likely IPv6 without brackets (ambiguous, skip)
                        portPart = parts[0]; // Fallback to first part
                    } else {
                        // Single part: just container port
                        portPart = parts[0];
                    }
                }

                // Extract host port and protocol
                // Protocol suffix is in the original port string (e.g., "6060:6060/udp")
                const protocolSplit = portPart.split('/');
                hostPort = protocolSplit[0];

                // Try to get protocol from portPart first, then from full port string
                if (protocolSplit[1]) {
                    protocol = protocolSplit[1];
                } else {
                    // Check if protocol is in the original port string
                    const portProtocolMatch = port.match(/\/(tcp|udp|sctp)$/i);
                    protocol = portProtocolMatch ? portProtocolMatch[1].toLowerCase() : 'tcp';
                }
            } else {
                hostPort = port.published;
                protocol = port.protocol || 'tcp';
            }
            allPorts.push({
                id: `port_${sanitizeId(name)}_${idx}`,
                label: hostPort,
                protocol,
                serviceId: sanitizeId(name)
            });
        });
    });

    // 3. Collect Storage (Storage Sidecar Zone)
    const storageNodes = [];
    // Volumes
    Object.keys(volumes).forEach(vName => {
        storageNodes.push({ id: `vol_${sanitizeId(vName)}`, type: 'volume', label: vName });
    });
    // Host Paths
    const hostPaths = new Map();
    Object.entries(services).forEach(([, svc]) => {
        normalizeArray(getValue(svc.volumes)).forEach(volRaw => {
            const vol = getValue(volRaw);
            const src = typeof vol === 'string' ? vol.split(':')[0] : '';
            if (src && (src.startsWith('.') || src.startsWith('/'))) {
                const shortPath = src.length > 20 ? '...' + src.slice(-17) : src;
                const bsId = btoa(src).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                const id = `hp_${bsId.substring(0, 10)}`;
                if (!hostPaths.has(id)) {
                    hostPaths.set(id, { id, type: 'hostPath', label: shortPath });
                    storageNodes.push({ id, type: 'hostPath', label: shortPath });
                }
            }
        });
    });
    // Secrets & Configs
    Object.keys(secrets).forEach(s => storageNodes.push({ id: `sec_${sanitizeId(s)}`, type: 'secret', label: s }));
    Object.keys(configs).forEach(c => storageNodes.push({ id: `cfg_${sanitizeId(c)}`, type: 'config', label: c }));


    // --- PHASE 2: DOT GENERATION (Universal Infrastructure Blueprint) ---

    let dot = `digraph G {\n`;
    dot += `  bgcolor="transparent"\n`;
    dot += `  rankdir=LR\n`; // Horizontal Flow (Left -> Right)
    dot += `  nodesep=0.6\n`;
    dot += `  ranksep=1.2\n`; // High separation between zones
    dot += `  splines=ortho\n`; // Strictly Orthogonal Lines
    dot += `  fontname="Inter"\n`;
    dot += `  fontsize=10\n`;
    dot += `  node [fontname="Inter", fontsize=10, style="filled,rounded", shape=box, penwidth=1.5, fixedsize=false, margin="0.2,0.1"]\n`;
    dot += `  edge [fontname="Inter", fontsize=9, penwidth=1.5, arrowsize=0.8]\n`;
    dot += `  compound=true\n`;
    dot += `  newrank=true\n\n`;

    // ---------------------------------------------------------
    // ZONE TV: STORAGE SIDECAR (Far Right)
    // Placed first in code but rank=sink forces it to far right
    // ---------------------------------------------------------
    if (storageNodes.length > 0) {
        dot += `  subgraph cluster_storage_sidecar {\n`;
        dot += `    label="📦 STORAGE & CONFIG"\n`;
        dot += `    style="dashed,rounded"\n`;
        dot += `    color="#64748b"\n`;
        dot += `    fontcolor="#94a3b8"\n`;
        dot += `    rank=sink\n`; // Enforce Far Right Position

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
            dot += `      width=1.5\n`; // Standard width for alignment
            dot += `    ]\n`;
        });

        // Vertical stacking spine for storage
        dot += `    { rank=same; ${storageIds[0]} }\n`;
        for (let i = 0; i < storageIds.length - 1; i++) {
            dot += `    ${storageIds[i]} -> ${storageIds[i + 1]} [style=invis, weight=10]\n`;
        }
        dot += `  }\n\n`;
    }

    // ---------------------------------------------------------
    // ZONE I: INGRESS RAIL (Far Left)
    // ---------------------------------------------------------
    if (allPorts.length > 0) {
        dot += `  subgraph cluster_ingress_zone {\n`;
        dot += `    label="⚡ ENTRY"\n`;
        dot += `    style=invis\n`;
        dot += `    rank=source\n`; // Force Leftmost Position

        const portIds = [];
        allPorts.forEach(p => {
            portIds.push(p.id);
            dot += `    ${p.id} [\n`;
            dot += `      label="${p.label}"\n`;
            dot += `      shape=circle, width=0.6, fixedsize=true\n`;
            dot += `      fillcolor="${COLORS.port.bg}", color="${COLORS.port.border}", fontcolor="${COLORS.port.text}"\n`;
            dot += `    ]\n`;
        });

        // Vertical Alignment Spine
        for (let i = 0; i < portIds.length - 1; i++) {
            dot += `    ${portIds[i]} -> ${portIds[i + 1]} [style=invis, weight=10]\n`;
        }
        dot += `  }\n\n`;
    }

    // ---------------------------------------------------------
    // NETWORK BOUNDARY (Zones II, III, IV)
    // ---------------------------------------------------------

    // Group services by primary network for visual boundaries
    const servicesByNetwork = new Map();
    Object.entries(services).forEach(([name, svc]) => {
        const net = normalizeArray(getValue(svc.networks))[0] || '_default';
        if (!servicesByNetwork.has(net)) servicesByNetwork.set(net, []);
        servicesByNetwork.get(net).push({ name, svc });
    });
    // Ensure standalone networks still render in the diagram
    Object.keys(networks).forEach(netName => {
        if (!servicesByNetwork.has(netName)) servicesByNetwork.set(netName, []);
    });

    for (const [netName, netServices] of servicesByNetwork) {
        dot += `  subgraph cluster_net_${sanitizeId(netName)} {\n`;
        dot += `    label="🌐 ${escapeLabel(netName)}"\n`;
        dot += `    style="filled,rounded"\n`;
        dot += `    color="${COLORS.network.border}"\n`;
        dot += `    fillcolor="#1e293b"\n`;
        dot += `    fontcolor="${COLORS.network.text}"\n`;
        dot += `    margin=16\n\n`;

        // Bucket services within this network by their Zone
        const gateways = [];
        const compute = [];
        const persistence = [];

        netServices.forEach(({ name, svc }) => {
            const zone = serviceZones.get(name);
            const tier = serviceTiers.get(name);
            const color = COLORS[tier] || COLORS.application;
            const imageStr = getValue(svc.image);
            const img = imageStr ? imageStr.split(':')[0] : 'image';

            // Get service-specific icon from centralized utility
            const icon = getServiceEmoji(name, imageStr) + ' ';

            const nodeDef = `
                ${sanitizeId(name)} [
                    label="${icon}${escapeLabel(name)}\\n<${escapeLabel(img)}>"
                    fillcolor="${color.bg}" color="${color.border}" fontcolor="${color.text}"
                ]`;

            if (zone === 'gateway') gateways.push(nodeDef);
            else if (zone === 'persistence') persistence.push(nodeDef);
            else compute.push(nodeDef);
        });

        // ZONE II: GATEWAY (Left Edge of Network)
        if (gateways.length > 0) {
            dot += `    subgraph cluster_zone_gateway {\n`;
            dot += `      label="" style=invis\n`; // Invisible grouping
            dot += `      rank=min\n`; // Pull to left
            dot += gateways.join('\n');
            dot += `    }\n`;
        }

        // ZONE III: COMPUTE (Center of Network)
        if (compute.length > 0) {
            dot += `    subgraph cluster_zone_compute {\n`;
            dot += `      label="" style=invis\n`;
            // No rank constraint (float center)
            dot += compute.join('\n');
            dot += `    }\n`;
        }

        // ZONE IV: PERSISTENCE (Right Edge of Network)
        if (persistence.length > 0) {
            dot += `    subgraph cluster_zone_persistence {\n`;
            dot += `      label="" style=invis\n`;
            dot += `      rank=max\n`; // Pull to right within subgraph
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

        dot += `  }\n`; // End Network
    }


    // --- PHASE 3: SEMANTIC ROUTING ---

    // 1. Ingress: Port -> Gateway/Service
    allPorts.forEach(p => {
        dot += `  ${p.id} -> ${p.serviceId} [\n`;
        dot += `    label="${p.protocol}"\n`;
        dot += `    color="${COLORS.edge.traffic}", fontcolor="${COLORS.edge.traffic}"\n`;
        dot += `    penwidth=2.5\n`; // Thicker for main traffic
        dot += `  ]\n`;
    });

    // 2. Data Flow: Gateway -> Compute -> Persistence
    // We infer flow from `depends_on`.
    // If App depends on DB, we draw arrow App -> DB (Call Flow).
    // In LR layout, with Persistence at Right, this naturally flows Left -> Right.
    // If Gateway depends on App... wait, normally Gateway forwards to App.
    // We want visually: Gateway --> App --> DB.

    // Explicitly add 'Forwarding' edges if we can infer them?
    // Hard without knowing config. We rely on valid `depends_on` or manual links.
    // But we CAN enforce `depends_on` styling.

    Object.entries(services).forEach(([name, svc]) => {
        const srcId = sanitizeId(name);
        // Handle both short and long syntax for depends_on
        const dependsOn = svc.depends_on;
        let deps = [];

        if (Array.isArray(dependsOn)) {
            // Short syntax: ["db", "redis"]
            deps = dependsOn.map(d => ({ name: d, condition: '' }));
        } else if (typeof dependsOn === 'object' && dependsOn !== null) {
            // Long syntax: { db: { condition: "service_healthy" } }
            deps = Object.entries(dependsOn).map(([d, config]) => ({
                name: d,
                condition: config.condition || ''
            }));
        }

        deps.forEach(dep => {
            if (services[dep.name]) {
                const depId = sanitizeId(dep.name);
                const condition = dep.condition.replace('service_', '');

                let label = '';
                // Don't modify label with special characters before final assembly
                if (condition) label = `\\n(${escapeLabel(condition)})`;

                dot += `  ${srcId} -> ${depId} [\n`;
                dot += `    label="${label}"\n`; // Use label directly as it's already formatted
                dot += `    color="${COLORS.edge.network}", style=solid\n`;
                dot += `    penwidth=1.5\n`;
                dot += `    fontsize=8\n`;
                dot += `    fontcolor="${COLORS.edge.network}"\n`;
                dot += `  ]\n`;
            }
        });
    });

    // 3. Storage Sidecar Mounts
    // Dashed lines from Service (Left) to Storage (Right).
    // Direction: Service -> Storage.
    // Visually: Container ----> Volume.

    Object.entries(services).forEach(([name, svc]) => {
        const svcId = sanitizeId(name);

        // Volumes/HostPaths
        normalizeArray(getValue(svc.volumes)).forEach(volRaw => {
            const vol = getValue(volRaw);
            const src = typeof vol === 'string' ? vol.split(':')[0] : '';
            let targetId = null;
            if (src && volumes[src]) targetId = `vol_${sanitizeId(src)}`;
            else if (src && (src.startsWith('.') || src.startsWith('/'))) {
                const bsId = btoa(src).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
                targetId = `hp_${bsId.substring(0, 10)}`;
            }

            if (targetId) {
                // Orthogonal routing for sidecar
                dot += `  ${svcId} -> ${targetId} [\n`;
                dot += `    style=dashed\n`;
                dot += `    color="${COLORS.edge.data}"\n`;
                // constraint=false lets orthogonal router find path without breaking ranks too much
                // BUT we want them on right.
                dot += `  ]\n`;
            }
        });

        // Secrets/Configs
        normalizeArray(getValue(svc.secrets)).forEach(sRaw => {
            const s = getValue(sRaw);
            const t = typeof s === 'string' ? s : s.source;
            if (secrets[t]) {
                dot += `  ${svcId} -> sec_${sanitizeId(t)} [style=dotted, color="${COLORS.edge.config}"]\n`;
            }
        });
        normalizeArray(getValue(svc.configs)).forEach(cRaw => {
            const c = getValue(cRaw);
            const t = typeof c === 'string' ? c : c.source;
            if (configs[t]) {
                dot += `  ${svcId} -> cfg_${sanitizeId(t)} [style=dotted, color="${COLORS.edge.config}"]\n`;
            }
        });
    });

    dot += `}\n`;
    return dot;
};

// Multi-project support
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

    // Render each project as a subgraph
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

        // Services
        Object.entries(content.services || {}).forEach(([serviceName, svc]) => {
            const nodeId = `${projectPrefix}${sanitizeId(serviceName)}`;
            const img = svc.image ? svc.image.split(':')[0] : 'build';
            const imgShort = img.length > 15 ? img.slice(0, 12) + '...' : img;
            const portLabels = normalizeArray(svc.ports)
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

        // Connect services to shared networks
        projects.forEach((project, idx) => {
            const content = project.content || {};
            const projectPrefix = `p${idx}_`;
            Object.entries(content.services || {}).forEach(([serviceName, svc]) => {
                normalizeArray(svc.networks).forEach(netName => {
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
