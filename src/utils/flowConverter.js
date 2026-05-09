import { normalizeDependsOn, normalizeArray } from './validation';
import { getSuggestionCounts, getHighestSeverity } from './suggestions';
import { normalizeToAST } from '../models/normalizeToAST.js';
import { MountTypes } from '../models/ComposeAST.js';

/**
 * Converts compose state to React Flow nodes and edges.
 * Uses the canonical AST for normalized data reads, raw state for UI positions.
 * @param {object} state - The compose state (raw, includes _position fields)
 * @param {Array} suggestions - List of suggestions from generateSuggestions
 * @returns {{ nodes: Array, edges: Array }}
 */
export function stateToFlow(state, suggestions = []) {
    const nodes = [];
    const edges = [];
    const ast = normalizeToAST(state);

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

    // Services — read from AST, positions from raw state
    let serviceIndex = 0;
    for (const service of ast.services) {
        const name = service.id;
        const rawSvc = state.services?.[name];
        const row = Math.floor(serviceIndex / SERVICES_PER_ROW);
        const col = serviceIndex % SERVICES_PER_ROW;

        const position = rawSvc?._position || {
            x: SERVICE_START_X + col * SERVICE_SPACING_X,
            y: SERVICE_START_Y + row * SERVICE_SPACING_Y,
        };

        const suggestionCounts = getSuggestionCounts(suggestions, name);
        const suggestionSeverity = getHighestSeverity(suggestions, name);

        nodes.push({
            id: `service-${name}`,
            type: 'serviceNode',
            position,
            data: {
                name,
                image: service.image,
                ports: service.ports.map(p => p.raw),
                hasHealthcheck: service.healthcheck !== null && !service.healthcheck?.disabled && service.healthcheck?.test?.length > 0,
                hasEnvFile: service.envFiles.length > 0,
                networks: service.networks.map(n => n.network),
                volumes: service.volumes.map(v => v.raw),
                suggestionCount: suggestionCounts.total,
                suggestionSeverity,
            },
        });

        // Dependency edges — from AST's pre-normalized dependencies
        for (const dep of service.dependencies) {
            edges.push({
                id: `dep-${name}-${dep.service}`,
                source: `service-${dep.service}`,
                target: `service-${name}`,
                type: 'dependsOnEdge',
                data: { condition: dep.condition },
                animated: true,
            });
        }

        // Network edges
        for (const net of service.networks) {
            edges.push({
                id: `net-${name}-${net.network}`,
                source: `service-${name}`,
                target: `network-${net.network}`,
                type: 'networkEdge',
            });
        }

        // Volume edges — from AST's pre-parsed volume mounts
        for (const vol of service.volumes) {
            if (vol.type === MountTypes.VOLUME && ast.volumeMap.has(vol.source)) {
                edges.push({
                    id: `vol-${name}-${vol.source}`,
                    source: `service-${name}`,
                    target: `volume-${vol.source}`,
                    type: 'volumeEdge',
                    data: { mountPath: vol.target },
                });
            }
        }

        serviceIndex++;
    }

    // Networks
    let networkIndex = 0;
    for (const network of ast.networks) {
        const name = network.id;
        const rawNet = state.networks?.[name];
        const position = rawNet?._position || {
            x: NETWORK_START_X + networkIndex * NETWORK_SPACING,
            y: NETWORK_START_Y,
        };

        const suggestionCounts = getSuggestionCounts(suggestions, name);
        const suggestionSeverity = getHighestSeverity(suggestions, name);

        nodes.push({
            id: `network-${name}`,
            type: 'networkNode',
            position,
            data: {
                name,
                driver: network.driver,
                external: network.external,
                suggestionCount: suggestionCounts.total,
                suggestionSeverity,
            },
        });
        networkIndex++;
    }

    // Volumes
    let volumeIndex = 0;
    for (const volume of ast.volumes) {
        const name = volume.id;
        const rawVol = state.volumes?.[name];
        const position = rawVol?._position || {
            x: VOLUME_START_X + volumeIndex * VOLUME_SPACING,
            y: VOLUME_START_Y,
        };

        const suggestionCounts = getSuggestionCounts(suggestions, name);
        const suggestionSeverity = getHighestSeverity(suggestions, name);

        nodes.push({
            id: `volume-${name}`,
            type: 'volumeNode',
            position,
            data: {
                name,
                driver: volume.driver,
                external: volume.external,
                suggestionCount: suggestionCounts.total,
                suggestionSeverity,
            },
        });
        volumeIndex++;
    }

    // Secrets
    let secretIndex = 0;
    for (const secret of ast.secrets) {
        const name = secret.id;
        const rawSec = state.secrets?.[name];
        const position = rawSec?._position || {
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
                external: secret.external,
            },
        });
        secretIndex++;
    }

    // Configs
    let configIndex = 0;
    for (const config of ast.configs) {
        const name = config.id;
        const rawCfg = state.configs?.[name];
        const position = rawCfg?._position || {
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
                external: config.external,
            },
        });
        configIndex++;
    }

    return { nodes, edges };
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
