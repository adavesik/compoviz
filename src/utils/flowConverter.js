import { normalizeDependsOn, normalizeArray } from './validation';

/**
 * Converts compose state to React Flow nodes and edges.
 * @param {object} state - The compose state
 * @returns {{ nodes: Array, edges: Array }}
 */
export function stateToFlow(state) {
    const nodes = [];
    const edges = [];

    // Layout constants
    const SERVICE_START_X = 300;
    const SERVICE_START_Y = 100;
    const SERVICE_SPACING_X = 280;
    const SERVICE_SPACING_Y = 200;
    const SERVICES_PER_ROW = 3;

    const NETWORK_START_X = 100;
    const NETWORK_START_Y = 500;
    const NETWORK_SPACING = 180;

    const VOLUME_START_X = 900;
    const VOLUME_START_Y = 500;
    const VOLUME_SPACING = 180;

    const SECRET_START_X = 100;
    const SECRET_START_Y = 700;
    const SECRET_SPACING = 180;

    const CONFIG_START_X = 500;
    const CONFIG_START_Y = 700;
    const CONFIG_SPACING = 180;

    // Services
    let serviceIndex = 0;
    for (const [name, service] of Object.entries(state.services || {})) {
        const row = Math.floor(serviceIndex / SERVICES_PER_ROW);
        const col = serviceIndex % SERVICES_PER_ROW;

        const position = service._position || {
            x: SERVICE_START_X + col * SERVICE_SPACING_X,
            y: SERVICE_START_Y + row * SERVICE_SPACING_Y,
        };

        nodes.push({
            id: `service-${name}`,
            type: 'serviceNode',
            position,
            data: {
                name,
                image: service.image,
                ports: service.ports || [],
                hasHealthcheck: !!service.healthcheck?.test,
                hasEnvFile: !!service.env_file?.length,
                networks: normalizeArray(service.networks),
                volumes: service.volumes || [],
            },
        });

        // Dependency edges
        const deps = normalizeDependsOn(service.depends_on);
        for (const dep of deps) {
            edges.push({
                id: `dep-${name}-${dep}`,
                source: `service-${dep}`,
                target: `service-${name}`,
                type: 'dependsOnEdge',
                data: { condition: getDependsOnCondition(service.depends_on, dep) },
                animated: true,
            });
        }

        // Network edges
        const networks = normalizeArray(service.networks);
        for (const net of networks) {
            edges.push({
                id: `net-${name}-${net}`,
                source: `service-${name}`,
                target: `network-${net}`,
                type: 'networkEdge',
            });
        }

        // Volume edges
        for (const vol of service.volumes || []) {
            const volName = extractVolumeName(vol);
            if (volName && state.volumes?.[volName]) {
                edges.push({
                    id: `vol-${name}-${volName}`,
                    source: `service-${name}`,
                    target: `volume-${volName}`,
                    type: 'volumeEdge',
                    data: { mountPath: extractMountPath(vol) },
                });
            }
        }

        serviceIndex++;
    }

    // Networks
    let networkIndex = 0;
    for (const [name, network] of Object.entries(state.networks || {})) {
        const position = network._position || {
            x: NETWORK_START_X + networkIndex * NETWORK_SPACING,
            y: NETWORK_START_Y,
        };

        nodes.push({
            id: `network-${name}`,
            type: 'networkNode',
            position,
            data: {
                name,
                driver: network.driver || 'bridge',
                external: network.external || false,
            },
        });
        networkIndex++;
    }

    // Volumes
    let volumeIndex = 0;
    for (const [name, volume] of Object.entries(state.volumes || {})) {
        const position = volume._position || {
            x: VOLUME_START_X + volumeIndex * VOLUME_SPACING,
            y: VOLUME_START_Y,
        };

        nodes.push({
            id: `volume-${name}`,
            type: 'volumeNode',
            position,
            data: {
                name,
                driver: volume.driver || 'local',
                external: volume.external || false,
            },
        });
        volumeIndex++;
    }

    // Secrets
    let secretIndex = 0;
    for (const [name, secret] of Object.entries(state.secrets || {})) {
        const position = secret._position || {
            x: SECRET_START_X + secretIndex * SECRET_SPACING,
            y: SECRET_START_Y,
        };

        nodes.push({
            id: `secret-${name}`,
            type: 'secretNode',
            position,
            data: {
                name,
                file: secret.file,
                external: secret.external || false,
            },
        });
        secretIndex++;
    }

    // Configs
    let configIndex = 0;
    for (const [name, config] of Object.entries(state.configs || {})) {
        const position = config._position || {
            x: CONFIG_START_X + configIndex * CONFIG_SPACING,
            y: CONFIG_START_Y,
        };

        nodes.push({
            id: `config-${name}`,
            type: 'configNode',
            position,
            data: {
                name,
                file: config.file,
                external: config.external || false,
            },
        });
        configIndex++;
    }

    return { nodes, edges };
}

/**
 * Extract depends_on condition from long syntax
 */
function getDependsOnCondition(dependsOn, depName) {
    if (Array.isArray(dependsOn)) return 'service_started';
    if (typeof dependsOn === 'object' && dependsOn[depName]) {
        return dependsOn[depName].condition || 'service_started';
    }
    return 'service_started';
}

/**
 * Extract volume name from mount string
 */
function extractVolumeName(vol) {
    if (typeof vol === 'string') {
        const parts = vol.split(':');
        // Named volume (not a path)
        if (parts[0] && !parts[0].startsWith('.') && !parts[0].startsWith('/')) {
            return parts[0];
        }
    }
    return null;
}

/**
 * Extract mount path from volume string
 */
function extractMountPath(vol) {
    if (typeof vol === 'string') {
        const parts = vol.split(':');
        return parts[1] || '';
    }
    return '';
}

/**
 * Parse node ID to get type and name
 */
export function parseNodeId(nodeId) {
    const [type, ...nameParts] = nodeId.split('-');
    return { type, name: nameParts.join('-') };
}

/**
 * Handle edge connection - dispatch appropriate action
 */
export function handleEdgeConnect(connection, state, dispatch) {
    const source = parseNodeId(connection.source);
    const target = parseNodeId(connection.target);

    // Service → Service = depends_on
    if (source.type === 'service' && target.type === 'service') {
        const service = state.services[target.name];
        const currentDeps = normalizeDependsOn(service?.depends_on);
        if (!currentDeps.includes(source.name)) {
            dispatch({
                type: 'UPDATE_SERVICE',
                name: target.name,
                data: { depends_on: [...currentDeps, source.name] },
            });
        }
        return true;
    }

    // Service → Network = join network
    if (source.type === 'service' && target.type === 'network') {
        const service = state.services[source.name];
        const currentNets = normalizeArray(service?.networks);
        if (!currentNets.includes(target.name)) {
            dispatch({
                type: 'UPDATE_SERVICE',
                name: source.name,
                data: { networks: [...currentNets, target.name] },
            });
        }
        return true;
    }

    // Service → Volume = mount volume
    if (source.type === 'service' && target.type === 'volume') {
        const service = state.services[source.name];
        const currentVols = service?.volumes || [];
        const newMount = `${target.name}:/data/${target.name}`;
        if (!currentVols.some(v => v.startsWith(target.name + ':'))) {
            dispatch({
                type: 'UPDATE_SERVICE',
                name: source.name,
                data: { volumes: [...currentVols, newMount] },
            });
        }
        return true;
    }

    return false;
}

/**
 * Handle edge deletion - dispatch appropriate action
 */
export function handleEdgeDelete(edge, state, dispatch) {
    const [edgeType] = edge.id.split('-');
    const source = parseNodeId(edge.source);
    const target = parseNodeId(edge.target);

    if (edgeType === 'dep') {
        // Remove dependency
        const service = state.services[target.name];
        const currentDeps = normalizeDependsOn(service?.depends_on);
        dispatch({
            type: 'UPDATE_SERVICE',
            name: target.name,
            data: { depends_on: currentDeps.filter(d => d !== source.name) },
        });
        return true;
    }

    if (edgeType === 'net') {
        // Remove from network
        const service = state.services[source.name];
        const currentNets = normalizeArray(service?.networks);
        dispatch({
            type: 'UPDATE_SERVICE',
            name: source.name,
            data: { networks: currentNets.filter(n => n !== target.name) },
        });
        return true;
    }

    if (edgeType === 'vol') {
        // Remove volume mount
        const service = state.services[source.name];
        const currentVols = service?.volumes || [];
        dispatch({
            type: 'UPDATE_SERVICE',
            name: source.name,
            data: { volumes: currentVols.filter(v => !v.startsWith(target.name + ':')) },
        });
        return true;
    }

    return false;
}
