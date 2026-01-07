import { normalizeDependsOn, normalizeArray } from './validation';

/**
 * Extract depends_on condition from long syntax
 */
const getDependsOnCondition = (dependsOn, depName) => {
    if (!dependsOn) return '';
    if (Array.isArray(dependsOn)) return '';
    if (typeof dependsOn === 'object' && dependsOn[depName]) {
        return dependsOn[depName].condition || '';
    }
    return '';
};

/**
 * Escape special characters for Mermaid labels
 */
const escapeLabel = (str) => {
    if (!str) return '';
    return String(str).replace(/"/g, "'").replace(/\n/g, ' ');
};

/**
 * Generates an enhanced Mermaid flowchart from the compose state.
 * Features:
 * - Docker Host outer boundary
 * - Services grouped by network
 * - Host path mounts as external nodes
 * - Port badges on services
 * - Healthcheck, env_file, labels indicators
 * - depends_on with condition labels
 * @param {object} state - The compose state.
 * @returns {string} The Mermaid graph definition.
 */
export const generateMermaidGraph = (state) => {
    const services = state.services || {};
    const networks = state.networks || {};
    const volumes = state.volumes || {};
    const secrets = state.secrets || {};
    const configs = state.configs || {};

    const serviceCount = Object.keys(services).length;
    if (serviceCount === 0) {
        return 'flowchart TB\n  empty["No services defined - add a service to visualize"]:::empty\n  classDef empty fill:#1e293b,stroke:#475569,color:#94a3b8';
    }

    let graph = `flowchart TB\n`;

    // Class definitions
    graph += `  %% Node styles\n`;
    graph += `  classDef service fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px,color:#fff,rx:8\n`;
    graph += `  classDef serviceHealthy fill:#166534,stroke:#22c55e,stroke-width:2px,color:#fff,rx:8\n`;
    graph += `  classDef network fill:#0f766e,stroke:#14b8a6,stroke-width:2px,color:#fff\n`;
    graph += `  classDef volume fill:#92400e,stroke:#f59e0b,stroke-width:2px,color:#fff\n`;
    graph += `  classDef hostPath fill:#78350f,stroke:#d97706,stroke-width:2px,color:#fff,stroke-dasharray:3\n`;
    graph += `  classDef secret fill:#6b21a8,stroke:#a855f7,stroke-width:2px,color:#fff\n`;
    graph += `  classDef config fill:#0e7490,stroke:#06b6d4,stroke-width:2px,color:#fff\n`;
    graph += `  classDef port fill:#dc2626,stroke:#fca5a5,stroke-width:1px,color:#fff,rx:4\n`;
    graph += `  classDef external fill:#1f2937,stroke:#6b7280,stroke-width:2px,color:#9ca3af,stroke-dasharray:5\n`;
    graph += `\n`;

    // Collect host paths (bind mounts) for external visualization
    const hostPaths = new Map(); // path -> [serviceName]
    Object.entries(services).forEach(([name, svc]) => {
        normalizeArray(svc.volumes).forEach(vol => {
            const src = typeof vol === 'string' ? vol.split(':')[0] : '';
            if (src && (src.startsWith('.') || src.startsWith('/'))) {
                const shortPath = src.length > 20 ? '...' + src.slice(-17) : src;
                if (!hostPaths.has(shortPath)) hostPaths.set(shortPath, { full: src, services: [] });
                hostPaths.get(shortPath).services.push(name);
            }
        });
    });

    // Docker Host container
    graph += `  subgraph dockerHost [" 🖥️ DOCKER HOST "]\n`;
    graph += `    direction TB\n`;

    // Networks as containers for services
    const networkNames = Object.keys(networks);
    const servicesByNetwork = new Map();

    // Group services by their primary network
    Object.entries(services).forEach(([name, svc]) => {
        const svcNetworks = normalizeArray(svc.networks);
        const primaryNet = svcNetworks[0] || '_default';
        if (!servicesByNetwork.has(primaryNet)) servicesByNetwork.set(primaryNet, []);
        servicesByNetwork.get(primaryNet).push({ name, svc });
    });

    // Render network subgraphs with their services
    for (const [netName, netServices] of servicesByNetwork) {
        const netConfig = networks[netName];
        const driver = netConfig?.driver || 'bridge';
        const isExternal = netConfig?.external;

        graph += `    subgraph net_${netName} [" 🌐 ${netName} (${driver})${isExternal ? ' 🔗' : ''} "]\n`;
        graph += `      direction LR\n`;

        for (const { name, svc } of netServices) {
            // Build service node content
            const img = svc.image || (svc.build ? 'Build: ' + (svc.build.dockerfile || 'Dockerfile') : '⚠️ no image');
            const imgShort = img.length > 25 ? img.slice(0, 22) + '...' : img;

            // Indicators
            const hasHealth = svc.healthcheck?.test ? '💚' : '';
            const hasEnvFile = normalizeArray(svc.env_file).length > 0 ? '📄' : '';
            const hasLabels = svc.labels && Object.keys(svc.labels).length > 0 ? '🏷️' : '';
            const indicators = [hasHealth, hasEnvFile, hasLabels].filter(Boolean).join('');

            // Port badges
            const portsArr = normalizeArray(svc.ports);

            // Service class
            const svcClass = svc.healthcheck?.test ? 'serviceHealthy' : 'service';

            // Main service node
            let label = `<b>${escapeLabel(name)}</b>`;
            if (svc.container_name && svc.container_name !== name) {
                label += `<br/><small>(${escapeLabel(svc.container_name)})</small>`;
            }
            label += `<br/><small>${escapeLabel(imgShort)}</small>`;
            if (indicators) label += `<br/>${indicators}`;

            graph += `      ${name}["${label}"]:::${svcClass}\n`;

            // Port nodes connected to service
            portsArr.forEach((port, idx) => {
                const portStr = typeof port === 'string' ? port : `${port.published}:${port.target}`;
                const hostPort = portStr.split(':')[0];
                graph += `      port_${name}_${idx}(["${hostPort}"]):::port\n`;
                graph += `      port_${name}_${idx} --> ${name}\n`;
            });
        }

        graph += `    end\n\n`;
    }

    // Named Volumes subgraph
    const volumeNames = Object.keys(volumes);
    if (volumeNames.length > 0) {
        graph += `    subgraph vol_group [" 💾 VOLUMES "]\n`;
        graph += `      direction TB\n`;
        volumeNames.forEach(vName => {
            const vol = volumes[vName];
            const driver = vol?.driver || 'local';
            graph += `      vol_${vName}[("${vName}<br/><small>${driver}</small>")]:::volume\n`;
        });
        graph += `    end\n\n`;
    }

    // Secrets subgraph
    const secretNames = Object.keys(secrets);
    if (secretNames.length > 0) {
        graph += `    subgraph sec_group [" 🔐 SECRETS "]\n`;
        secretNames.forEach(sName => {
            graph += `      sec_${sName}{{"🔑 ${sName}"}}:::secret\n`;
        });
        graph += `    end\n\n`;
    }

    // Configs subgraph
    const configNames = Object.keys(configs);
    if (configNames.length > 0) {
        graph += `    subgraph cfg_group [" ⚙️ CONFIGS "]\n`;
        configNames.forEach(cName => {
            graph += `      cfg_${cName}[/"📄 ${cName}"/]:::config\n`;
        });
        graph += `    end\n\n`;
    }

    graph += `  end\n\n`; // End Docker Host

    // Host Paths (outside Docker Host)
    if (hostPaths.size > 0) {
        graph += `  subgraph hostPaths [" 📁 HOST PATHS "]\n`;
        graph += `    direction TB\n`;
        let pathIdx = 0;
        hostPaths.forEach((data, shortPath) => {
            graph += `    hp_${pathIdx}["${shortPath}"]:::hostPath\n`;
            pathIdx++;
        });
        graph += `  end\n\n`;
    }

    // Relationships
    let edgeIdx = 0;
    const dependsEdges = [];
    const volumeEdges = [];
    const secretEdges = [];
    const configEdges = [];
    const hostPathEdges = [];

    Object.entries(services).forEach(([name, svc]) => {
        // depends_on with condition labels
        const dependsOn = svc.depends_on;
        normalizeDependsOn(dependsOn).forEach(dep => {
            if (services[dep]) {
                const condition = getDependsOnCondition(dependsOn, dep);
                const condLabel = condition ? condition.replace('service_', '') : 'started';
                graph += `  ${dep} -->|"${condLabel}"| ${name}\n`;
                dependsEdges.push(edgeIdx++);
            }
        });

        // Volume connections
        normalizeArray(svc.volumes).forEach(vol => {
            const src = typeof vol === 'string' ? vol.split(':')[0] : '';
            const target = typeof vol === 'string' ? vol.split(':')[1] : '';

            // Named volume
            if (src && volumes[src]) {
                const targetShort = target && target.length > 15 ? '...' + target.slice(-12) : target;
                graph += `  vol_${src} -.->|"${targetShort}"| ${name}\n`;
                volumeEdges.push(edgeIdx++);
            }
            // Host path
            else if (src && (src.startsWith('.') || src.startsWith('/'))) {
                const shortPath = src.length > 20 ? '...' + src.slice(-17) : src;
                let pathIdx = 0;
                hostPaths.forEach((data, sp) => {
                    if (sp === shortPath && data.services.includes(name)) {
                        graph += `  hp_${pathIdx} -.-> ${name}\n`;
                        hostPathEdges.push(edgeIdx++);
                    }
                    pathIdx++;
                });
            }
        });

        // Secrets
        normalizeArray(svc.secrets).forEach(sec => {
            const secName = typeof sec === 'string' ? sec : sec?.source;
            if (secName && secrets[secName]) {
                graph += `  sec_${secName} -.-> ${name}\n`;
                secretEdges.push(edgeIdx++);
            }
        });

        // Configs
        normalizeArray(svc.configs).forEach(cfg => {
            const cfgName = typeof cfg === 'string' ? cfg : cfg?.source;
            if (cfgName && configs[cfgName]) {
                graph += `  cfg_${cfgName} -.-> ${name}\n`;
                configEdges.push(edgeIdx++);
            }
        });
    });

    // Edge styles
    if (dependsEdges.length > 0) {
        graph += `  linkStyle ${dependsEdges.join(',')} stroke:#f472b6,stroke-width:2px\n`;
    }
    if (volumeEdges.length > 0) {
        graph += `  linkStyle ${volumeEdges.join(',')} stroke:#fbbf24,stroke-width:2px,stroke-dasharray:3\n`;
    }
    if (hostPathEdges.length > 0) {
        graph += `  linkStyle ${hostPathEdges.join(',')} stroke:#d97706,stroke-width:2px,stroke-dasharray:5\n`;
    }
    if (secretEdges.length > 0) {
        graph += `  linkStyle ${secretEdges.join(',')} stroke:#a855f7,stroke-width:2px,stroke-dasharray:3\n`;
    }
    if (configEdges.length > 0) {
        graph += `  linkStyle ${configEdges.join(',')} stroke:#06b6d4,stroke-width:2px,stroke-dasharray:3\n`;
    }

    return graph;
};

// Project colors for multi-project view
const PROJECT_COLORS = [
    { bg: '#1e3a8a', stroke: '#3b82f6', name: 'blue' },   // Blue
    { bg: '#065f46', stroke: '#10b981', name: 'green' },  // Green
    { bg: '#164e63', stroke: '#06b6d4', name: 'cyan' },   // Cyan (colorblind-friendly)
];

/**
 * Generates a Mermaid flowchart for multiple projects.
 * @param {Array<{id: string, name: string, content: object}>} projects - Array of projects
 * @param {Array} conflicts - Array of conflict results from comparison
 * @returns {string} The Mermaid graph definition
 */
export const generateMultiProjectGraph = (projects, conflicts = []) => {
    if (!projects || projects.length === 0) {
        return 'flowchart TB\n  empty["No projects loaded"]';
    }

    let graph = `flowchart LR\n`;

    // Class definitions for each project
    projects.forEach((project, idx) => {
        const color = PROJECT_COLORS[idx % PROJECT_COLORS.length];
        graph += `  classDef project${idx} fill:${color.bg},stroke:${color.stroke},stroke-width:2px,color:#fff,rx:8,ry:8\n`;
    });

    // Conflict highlighting
    graph += `  classDef conflict fill:#991b1b,stroke:#ef4444,stroke-width:3px,color:#fff\n`;
    graph += `  classDef shared fill:#4c1d95,stroke:#a78bfa,stroke-width:2px,color:#fff,stroke-dasharray:5\n`;
    graph += `  classDef network fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff\n`;
    graph += `  classDef volume fill:#78350f,stroke:#f59e0b,stroke-width:2px,color:#fff\n`;
    graph += `\n`;

    // Build conflict lookup for quick access
    const conflictPorts = new Set();
    const conflictContainers = new Set();
    const sharedNetworks = new Set();

    conflicts.forEach(c => {
        if (c.category === 'port' && c.type === 'conflict') {
            c.details?.forEach(d => conflictPorts.add(`${d.project}:${d.service}`));
        }
        if (c.category === 'container_name' && c.type === 'conflict') {
            c.details?.forEach(d => conflictContainers.add(`${d.project}:${d.service}`));
        }
        if (c.category === 'network' && c.type === 'shared') {
            sharedNetworks.add(c.details?.networkName);
        }
    });

    // Collect all networks and volumes across projects for shared rendering
    const allNetworks = new Map(); // networkName -> [projectIdx]
    const allVolumes = new Map(); // volumeName -> [projectIdx]

    projects.forEach((project, idx) => {
        const content = project.content || {};
        Object.keys(content.networks || {}).forEach(netName => {
            if (!allNetworks.has(netName)) allNetworks.set(netName, []);
            allNetworks.get(netName).push(idx);
        });
        Object.keys(content.volumes || {}).forEach(volName => {
            if (!allVolumes.has(volName)) allVolumes.set(volName, []);
            allVolumes.get(volName).push(idx);
        });
    });

    // Render each project as a subgraph
    projects.forEach((project, idx) => {
        const content = project.content || {};
        const projectPrefix = `p${idx}_`;
        const emoji = ['🔵', '🟢', '🟠'][idx % 3];

        graph += `  subgraph ${projectPrefix}main ["${emoji} ${project.name || 'Project ' + (idx + 1)}"]\n`;
        graph += `    direction TB\n`;

        // Services
        Object.entries(content.services || {}).forEach(([serviceName, svc]) => {
            const nodeId = `${projectPrefix}${serviceName}`;
            const img = svc.image ? svc.image.split(':')[0] : 'build';
            const portsArr = normalizeArray(svc.ports);
            const portLabel = portsArr.length > 0 ? `<br/><small>🔌 ${portsArr[0]}</small>` : '';

            // Check if this service has conflicts
            const serviceKey = `${project.name}:${serviceName}`;
            const hasConflict = conflictPorts.has(serviceKey) || conflictContainers.has(serviceKey);
            const nodeClass = hasConflict ? 'conflict' : `project${idx}`;

            graph += `    ${nodeId}["<b>${serviceName}</b><br/><small>${img}</small>${portLabel}"]:::${nodeClass}\n`;
        });

        graph += `  end\n\n`;
    });

    // Render shared networks (outside project subgraphs)
    const sharedNetworksList = [...allNetworks.entries()].filter(([_, projs]) => projs.length > 1);
    if (sharedNetworksList.length > 0) {
        graph += `  subgraph shared_infra [" 🌐 SHARED NETWORKS "]\n`;
        sharedNetworksList.forEach(([netName, _]) => {
            graph += `    shared_net_${netName}(("${netName}")):::shared\n`;
        });
        graph += `  end\n\n`;
    }

    // Edge connections for shared networks
    let edgeIdx = 0;
    const sharedEdges = [];

    projects.forEach((project, idx) => {
        const content = project.content || {};
        const projectPrefix = `p${idx}_`;

        Object.entries(content.services || {}).forEach(([serviceName, svc]) => {
            normalizeArray(svc.networks).forEach(netName => {
                if (allNetworks.get(netName)?.length > 1) {
                    // Connect to shared network
                    graph += `  ${projectPrefix}${serviceName} -.-> shared_net_${netName}\n`;
                    sharedEdges.push(edgeIdx++);
                }
            });
        });
    });

    // Style shared edges
    if (sharedEdges.length > 0) {
        graph += `  linkStyle ${sharedEdges.join(',')} stroke:#a78bfa,stroke-width:2px,stroke-dasharray:5\n`;
    }

    return graph;
};
