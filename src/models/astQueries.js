/**
 * AST Query Utilities
 * 
 * Convenience functions for querying the ComposeAST.
 * These replace the scattered normalization logic that currently lives
 * in graphviz.js, flowConverter.js, validation.js, and suggestions.js.
 * 
 * Consumers import these instead of re-parsing raw Compose shapes.
 */

import { ServiceTiers, MountTypes } from './ComposeAST.js';

// ─── Service Queries ────────────────────────────────────────────────────────

/**
 * Get all services in a specific tier.
 * @param {ComposeAST} ast
 * @param {ServiceTier} tier
 * @returns {ServiceNode[]}
 */
export function getServicesByTier(ast, tier) {
    return ast.services.filter(s => s.classification.tier === tier);
}

/**
 * Get all services in a specific role.
 * @param {ComposeAST} ast
 * @param {ServiceRole} role
 * @returns {ServiceNode[]}
 */
export function getServicesByRole(ast, role) {
    return ast.services.filter(s => s.classification.role === role);
}

/**
 * Get the effective image for a service (explicit or resolved from Dockerfile).
 * @param {ServiceNode} service
 * @returns {string|null}
 */
export function getEffectiveImage(service) {
    return service.image || service.runtime.resolvedImage || null;
}

/**
 * Get the effective ports for a service (explicit or resolved from Dockerfile).
 * @param {ServiceNode} service
 * @returns {PortBinding[]}
 */
export function getEffectivePorts(service) {
    if (service.ports.length > 0) return service.ports;
    return service.runtime.resolvedPorts;
}

/**
 * Get all services that depend on a given service.
 * @param {ComposeAST} ast
 * @param {string} serviceId
 * @returns {ServiceNode[]}
 */
export function getDependents(ast, serviceId) {
    return ast.services.filter(s =>
        s.dependencies.some(d => d.service === serviceId)
    );
}

/**
 * Get all services that a given service depends on.
 * @param {ComposeAST} ast
 * @param {string} serviceId
 * @returns {ServiceNode[]}
 */
export function getDependencies(ast, serviceId) {
    const service = ast.serviceMap.get(serviceId);
    if (!service) return [];
    return service.dependencies
        .map(d => ast.serviceMap.get(d.service))
        .filter(Boolean);
}

/**
 * Check if a service has a healthcheck configured.
 * @param {ServiceNode} service
 * @returns {boolean}
 */
export function hasHealthcheck(service) {
    return service.healthcheck !== null && !service.healthcheck.disabled && service.healthcheck.test.length > 0;
}

/**
 * Check if a service has resource limits configured.
 * @param {ServiceNode} service
 * @returns {boolean}
 */
export function hasResourceLimits(service) {
    return service.deploy?.limits?.cpus != null || service.deploy?.limits?.memory != null;
}

// ─── Network Queries ────────────────────────────────────────────────────────

/**
 * Get all services attached to a specific network.
 * @param {ComposeAST} ast
 * @param {string} networkId
 * @returns {ServiceNode[]}
 */
export function getServicesOnNetwork(ast, networkId) {
    return ast.services.filter(s =>
        s.networks.some(n => n.network === networkId)
    );
}

/**
 * Get the primary network for a service (first attached network, or '_default').
 * @param {ServiceNode} service
 * @returns {string}
 */
export function getPrimaryNetwork(service) {
    return service.networks[0]?.network || '_default';
}

/**
 * Get all networks that have no services attached.
 * @param {ComposeAST} ast
 * @returns {NetworkNode[]}
 */
export function getOrphanedNetworks(ast) {
    const usedNetworks = new Set();
    for (const service of ast.services) {
        for (const net of service.networks) {
            usedNetworks.add(net.network);
        }
    }
    return ast.networks.filter(n => !usedNetworks.has(n.id));
}

// ─── Volume Queries ─────────────────────────────────────────────────────────

/**
 * Get all services that mount a specific volume.
 * @param {ComposeAST} ast
 * @param {string} volumeId
 * @returns {ServiceNode[]}
 */
export function getServicesUsingVolume(ast, volumeId) {
    return ast.services.filter(s =>
        s.volumes.some(v => v.source === volumeId && v.type === MountTypes.VOLUME)
    );
}

/**
 * Get all volumes that have no services mounting them.
 * @param {ComposeAST} ast
 * @returns {VolumeNode[]}
 */
export function getOrphanedVolumes(ast) {
    const usedVolumes = new Set();
    for (const service of ast.services) {
        for (const vol of service.volumes) {
            if (vol.type === MountTypes.VOLUME) {
                usedVolumes.add(vol.source);
            }
        }
    }
    return ast.volumes.filter(v => !usedVolumes.has(v.id));
}

/**
 * Get all unique bind mount paths across all services.
 * @param {ComposeAST} ast
 * @returns {Array<{path: string, services: string[]}>}
 */
export function getBindMounts(ast) {
    const pathMap = new Map();
    for (const service of ast.services) {
        for (const vol of service.volumes) {
            if (vol.type === MountTypes.BIND) {
                if (!pathMap.has(vol.source)) {
                    pathMap.set(vol.source, []);
                }
                pathMap.get(vol.source).push(service.id);
            }
        }
    }
    return [...pathMap.entries()].map(([path, services]) => ({ path, services }));
}

// ─── Port Queries ───────────────────────────────────────────────────────────

/**
 * Get all host port bindings across all services (for conflict detection).
 * @param {ComposeAST} ast
 * @returns {Array<{binding: string, service: string, port: PortBinding}>}
 */
export function getAllHostBindings(ast) {
    const bindings = [];
    for (const service of ast.services) {
        for (const port of getEffectivePorts(service)) {
            const binding = `${port.hostIp}:${port.hostPort}`;
            bindings.push({ binding, service: service.id, port });
        }
    }
    return bindings;
}

/**
 * Detect port conflicts (same host binding used by multiple services).
 * @param {ComposeAST} ast
 * @returns {Array<{binding: string, services: string[]}>}
 */
export function getPortConflicts(ast) {
    const bindingMap = new Map();
    for (const { binding, service } of getAllHostBindings(ast)) {
        if (!bindingMap.has(binding)) bindingMap.set(binding, []);
        bindingMap.get(binding).push(service);
    }
    return [...bindingMap.entries()]
        .filter(([, services]) => services.length > 1)
        .map(([binding, services]) => ({ binding, services }));
}

// ─── Topology Queries ───────────────────────────────────────────────────────

/**
 * Get the dependency graph as adjacency list.
 * @param {ComposeAST} ast
 * @returns {Map<string, string[]>} service -> services it depends on
 */
export function getDependencyGraph(ast) {
    const graph = new Map();
    for (const service of ast.services) {
        graph.set(service.id, service.dependencies.map(d => d.service));
    }
    return graph;
}

/**
 * Detect circular dependencies.
 * @param {ComposeAST} ast
 * @returns {string[][]} Array of cycles (each cycle is array of service names)
 */
export function detectCycles(ast) {
    const graph = getDependencyGraph(ast);
    const cycles = [];
    const visited = new Set();
    const inStack = new Set();

    function dfs(node, path) {
        if (inStack.has(node)) {
            const cycleStart = path.indexOf(node);
            if (cycleStart !== -1) {
                cycles.push(path.slice(cycleStart).concat(node));
            }
            return;
        }
        if (visited.has(node)) return;

        visited.add(node);
        inStack.add(node);
        path.push(node);

        for (const dep of (graph.get(node) || [])) {
            dfs(dep, [...path]);
        }

        inStack.delete(node);
    }

    for (const service of ast.services) {
        if (!visited.has(service.id)) {
            dfs(service.id, []);
        }
    }

    return cycles;
}

/**
 * Get topological sort of services (respecting dependencies).
 * Returns null if there are cycles.
 * @param {ComposeAST} ast
 * @returns {string[]|null}
 */
export function getTopologicalOrder(ast) {
    const graph = getDependencyGraph(ast);
    const inDegree = new Map();
    const allNodes = new Set();

    for (const service of ast.services) {
        allNodes.add(service.id);
        if (!inDegree.has(service.id)) inDegree.set(service.id, 0);
    }

    for (const [, deps] of graph) {
        for (const dep of deps) {
            inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
        }
    }

    // Note: in depends_on semantics, if A depends_on B, B starts first.
    // So we reverse: B has no incoming edges from this perspective.
    // Actually depends_on means "A needs B" so B should come first in startup order.
    // Let's compute startup order (dependencies first).
    const reverseGraph = new Map();
    for (const node of allNodes) reverseGraph.set(node, []);
    for (const [node, deps] of graph) {
        for (const dep of deps) {
            if (reverseGraph.has(dep)) {
                reverseGraph.get(dep).push(node);
            }
        }
    }

    const startupInDegree = new Map();
    for (const node of allNodes) startupInDegree.set(node, 0);
    for (const [node, deps] of graph) {
        startupInDegree.set(node, deps.filter(d => allNodes.has(d)).length);
    }

    const queue = [];
    for (const [node, degree] of startupInDegree) {
        if (degree === 0) queue.push(node);
    }

    const order = [];
    while (queue.length > 0) {
        const node = queue.shift();
        order.push(node);
        for (const dependent of (reverseGraph.get(node) || [])) {
            const newDegree = startupInDegree.get(dependent) - 1;
            startupInDegree.set(dependent, newDegree);
            if (newDegree === 0) queue.push(dependent);
        }
    }

    return order.length === allNodes.size ? order : null;
}

// ─── Secret/Config Queries ──────────────────────────────────────────────────

/**
 * Get all services that use a specific secret.
 * @param {ComposeAST} ast
 * @param {string} secretId
 * @returns {ServiceNode[]}
 */
export function getServicesUsingSecret(ast, secretId) {
    return ast.services.filter(s => s.secrets.includes(secretId));
}

/**
 * Get all services that use a specific config.
 * @param {ComposeAST} ast
 * @param {string} configId
 * @returns {ServiceNode[]}
 */
export function getServicesUsingConfig(ast, configId) {
    return ast.services.filter(s => s.configs.includes(configId));
}
