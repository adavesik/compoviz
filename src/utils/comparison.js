import { normalizeToAST } from '../models/normalizeToAST.js';
import { MountTypes } from '../models/ComposeAST.js';

/**
 * Represents a conflict or shared resource between projects.
 * @typedef {Object} ComparisonResult
 * @property {string} type - 'conflict' | 'shared'
 * @property {string} category - 'port' | 'volume' | 'network' | 'container_name' | 'service_name' | 'env_file'
 * @property {string} severity - 'error' | 'warning' | 'info'
 * @property {string} message - Human-readable description
 * @property {string[]} projects - Names of projects involved
 * @property {any} details - Additional context
 */

/**
 * Extract host binding (IP:Port) from a port mapping string.
 * Returns the full binding specification to properly detect conflicts.
 * Ports bound to different IPs (e.g., 127.0.0.1:80 vs 0.0.0.0:80) don't conflict.
 * Supports IPv4, IPv6 (with/without brackets), and all Docker Compose port formats.
 * @param {string} portMapping - e.g., "8080:80", "127.0.0.1:3000:3000/tcp", "[::1]:8080:80"
 * @returns {string|null} The host binding (IP:Port) or null
 */
export const extractHostPort = (portMapping) => {
    if (!portMapping || typeof portMapping !== 'string') return null;

    let ip, hostPort;

    // Handle IPv6 with square brackets: [::1]:8080:80 or [::1]:8080
    if (portMapping.startsWith('[')) {
        const closeBracket = portMapping.indexOf(']');
        if (closeBracket === -1) return null; // Invalid format

        ip = portMapping.substring(0, closeBracket + 1); // Include brackets
        const remaining = portMapping.substring(closeBracket + 1);

        // Parse remaining part after IPv6
        if (remaining.startsWith(':')) {
            const remainingParts = remaining.substring(1).split(':');
            if (remainingParts.length >= 1) {
                // Format: [::1]:HOST:CONTAINER or [::1]:CONTAINER
                hostPort = remainingParts[0];
            } else {
                return null;
            }
        } else {
            return null; // Invalid format
        }
    } else {
        // Handle IPv4 or IPv6 without brackets
        const parts = portMapping.split(':');

        if (parts.length === 2) {
            // Format: HOST:CONTAINER (no IP specified, binds to all interfaces)
            ip = '0.0.0.0';
            hostPort = parts[0];
        } else if (parts.length === 3) {
            // Format: IP:HOST:CONTAINER (IPv4)
            if (parts[0] === '' && parts[1] === '') {
                // Starts with ::, likely IPv6 like ::1:8080:80
                return null; // Skip ambiguous IPv6 without brackets
            }
            ip = parts[0];
            hostPort = parts[1];
        } else if (parts.length > 3) {
            // Likely IPv6 without brackets
            return null;
        } else {
            // Single part, just container port
            return null;
        }
    }

    if (!hostPort) return null;

    // Remove protocol suffix if present (e.g., "80/tcp" → "80")
    hostPort = hostPort.split('/')[0];

    // Return full binding specification
    return `${ip}:${hostPort}`;
};

/**
 * Compare multiple projects and detect conflicts and shared resources.
 * Normalizes each project to AST for consistent data reads.
 * @param {Array<{id: string, name: string, content: object}>} projects
 * @returns {ComparisonResult[]}
 */
export function compareProjects(projects) {
    const results = [];
    if (!projects || projects.length < 2) return results;

    // Normalize each project to AST
    const projectASTs = projects.map(project => ({
        name: project.name,
        ast: normalizeToAST(project.content || {}),
    }));

    // Collect data from all projects using AST
    const portMap = new Map(); // hostBinding -> [{project, service}]
    const containerNameMap = new Map(); // containerName -> [{project, service}]
    const serviceNameMap = new Map(); // serviceName -> [project]
    const volumeMap = new Map(); // volumeSource -> [{project, service}]
    const networkMap = new Map(); // networkName -> [project]
    const envFileMap = new Map(); // envFilePath -> [{project, service}]

    for (const { name: projectName, ast } of projectASTs) {
        // Collect services data from AST
        for (const service of ast.services) {
            const serviceName = service.id;

            // Service names
            if (!serviceNameMap.has(serviceName)) serviceNameMap.set(serviceName, []);
            serviceNameMap.get(serviceName).push(projectName);

            // Container names
            if (service.containerName) {
                if (!containerNameMap.has(service.containerName)) containerNameMap.set(service.containerName, []);
                containerNameMap.get(service.containerName).push({ project: projectName, service: serviceName });
            }

            // Ports — use pre-parsed port bindings from AST
            for (const port of service.ports) {
                // Build binding string matching extractHostPort format for IPv6 compat
                let binding;
                if (port.hostIp && port.hostIp.includes(':')) {
                    // IPv6 — wrap in brackets
                    binding = `[${port.hostIp}]:${port.hostPort}`;
                } else {
                    binding = `${port.hostIp || '0.0.0.0'}:${port.hostPort}`;
                }

                if (binding && port.hostPort) {
                    if (!portMap.has(binding)) portMap.set(binding, []);
                    portMap.get(binding).push({ project: projectName, service: serviceName, mapping: port.raw });
                }
            }

            // Volumes — use pre-parsed volume mounts from AST
            for (const vol of service.volumes) {
                const source = vol.source;
                if (source) {
                    if (!volumeMap.has(source)) volumeMap.set(source, []);
                    volumeMap.get(source).push({ project: projectName, service: serviceName, mapping: vol.raw });
                }
            }

            // Env files — pre-normalized in AST
            for (const envFile of service.envFiles) {
                if (!envFileMap.has(envFile)) envFileMap.set(envFile, []);
                envFileMap.get(envFile).push({ project: projectName, service: serviceName });
            }
        }

        // Collect networks from AST
        for (const network of ast.networks) {
            if (!networkMap.has(network.id)) networkMap.set(network.id, []);
            networkMap.get(network.id).push(projectName);
        }
    }

    // Detect port conflicts
    for (const [binding, usages] of portMap.entries()) {
        if (usages.length > 1) {
            const projectsInvolved = [...new Set(usages.map(u => u.project))];
            if (projectsInvolved.length > 1) {
                results.push({
                    type: 'conflict',
                    category: 'port',
                    severity: 'error',
                    message: `Port binding ${binding} is used by multiple projects`,
                    projects: projectsInvolved,
                    details: usages,
                });
            }
        }
    }

    // Detect container name conflicts
    for (const [name, usages] of containerNameMap.entries()) {
        if (usages.length > 1) {
            const projectsInvolved = [...new Set(usages.map(u => u.project))];
            if (projectsInvolved.length > 1) {
                results.push({
                    type: 'conflict',
                    category: 'container_name',
                    severity: 'error',
                    message: `Container name "${name}" is used by multiple projects`,
                    projects: projectsInvolved,
                    details: usages,
                });
            }
        }
    }

    // Detect shared volumes (could be intentional or conflict)
    for (const [source, usages] of volumeMap.entries()) {
        if (usages.length > 1) {
            const projectsInvolved = [...new Set(usages.map(u => u.project))];
            if (projectsInvolved.length > 1) {
                const isHostPath = source.startsWith('.') || source.startsWith('/');
                results.push({
                    type: isHostPath ? 'conflict' : 'shared',
                    category: 'volume',
                    severity: isHostPath ? 'warning' : 'info',
                    message: isHostPath
                        ? `Host path "${source}" is mounted by multiple projects`
                        : `Volume "${source}" is used by multiple projects`,
                    projects: projectsInvolved,
                    details: usages,
                });
            }
        }
    }

    // Detect shared networks (often intentional)
    for (const [networkName, projectsList] of networkMap.entries()) {
        if (projectsList.length > 1) {
            results.push({
                type: 'shared',
                category: 'network',
                severity: 'info',
                message: `Network "${networkName}" is defined in multiple projects`,
                projects: projectsList,
                details: { networkName },
            });
        }
    }

    // Detect shared env files
    for (const [envFile, usages] of envFileMap.entries()) {
        if (usages.length > 1) {
            const projectsInvolved = [...new Set(usages.map(u => u.project))];
            if (projectsInvolved.length > 1) {
                results.push({
                    type: 'shared',
                    category: 'env_file',
                    severity: 'info',
                    message: `Env file "${envFile}" is used by multiple projects`,
                    projects: projectsInvolved,
                    details: usages,
                });
            }
        }
    }

    // Detect duplicate service names (informational)
    for (const [serviceName, projectsList] of serviceNameMap.entries()) {
        if (projectsList.length > 1) {
            results.push({
                type: 'shared',
                category: 'service_name',
                severity: 'info',
                message: `Service name "${serviceName}" exists in multiple projects`,
                projects: projectsList,
                details: { serviceName },
            });
        }
    }

    return results;
}

/**
 * Get comparison summary counts by severity.
 * @param {ComparisonResult[]} results
 * @returns {{errors: number, warnings: number, info: number}}
 */
export function getComparisonSummary(results) {
    return {
        errors: results.filter(r => r.severity === 'error').length,
        warnings: results.filter(r => r.severity === 'warning').length,
        info: results.filter(r => r.severity === 'info').length,
    };
}
