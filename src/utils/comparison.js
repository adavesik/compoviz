import { normalizeArray } from './validation';

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
 * @param {string} portMapping - e.g., "8080:80", "127.0.0.1:3000:3000/tcp"
 * @returns {string|null} The host binding (IP:Port) or null
 */
const extractHostPort = (portMapping) => {
    if (!portMapping || typeof portMapping !== 'string') return null;
    const parts = portMapping.split(':');

    if (parts.length >= 2) {
        let ip, hostPort;

        // Determine if there's an IP address specified
        if (parts.length === 3) {
            // Format: IP:HOST:CONTAINER
            ip = parts[0];
            hostPort = parts[1];
        } else if (parts.length === 2) {
            // Format: HOST:CONTAINER (no IP specified, binds to all interfaces)
            ip = '0.0.0.0';
            hostPort = parts[0];
        } else {
            // Format with 4+ parts (IPv6 or invalid), skip for now
            return null;
        }

        // Remove protocol suffix if present (e.g., "80/tcp" → "80")
        hostPort = hostPort.split('/')[0];

        // Return full binding specification
        return `${ip}:${hostPort}`;
    }
    return null;
};

/**
 * Extract volume source from a volume mapping.
 * @param {string} volumeMapping - e.g., "data:/app/data", "./src:/app/src"
 * @returns {string|null} The source (host path or volume name)
 */
const extractVolumeSource = (volumeMapping) => {
    if (!volumeMapping || typeof volumeMapping !== 'string') return null;
    const parts = volumeMapping.split(':');
    return parts[0] || null;
};

/**
 * Compare multiple projects and detect conflicts and shared resources.
 * @param {Array<{id: string, name: string, content: object}>} projects
 * @returns {ComparisonResult[]}
 */
export function compareProjects(projects) {
    const results = [];
    if (!projects || projects.length < 2) return results;

    // Collect data from all projects
    const portMap = new Map(); // hostPort -> [{project, service}]
    const containerNameMap = new Map(); // containerName -> [{project, service}]
    const serviceNameMap = new Map(); // serviceName -> [project]
    const volumeMap = new Map(); // volumeSource -> [{project, service}]
    const networkMap = new Map(); // networkName -> [project]
    const envFileMap = new Map(); // envFilePath -> [{project, service}]

    for (const project of projects) {
        const { name: projectName, content } = project;
        if (!content) continue;

        // Collect services data
        for (const [serviceName, service] of Object.entries(content.services || {})) {
            // Service names
            if (!serviceNameMap.has(serviceName)) serviceNameMap.set(serviceName, []);
            serviceNameMap.get(serviceName).push(projectName);

            // Container names
            if (service.container_name) {
                if (!containerNameMap.has(service.container_name)) containerNameMap.set(service.container_name, []);
                containerNameMap.get(service.container_name).push({ project: projectName, service: serviceName });
            }

            // Ports
            for (const port of normalizeArray(service.ports)) {
                const hostPort = extractHostPort(port);
                if (hostPort) {
                    if (!portMap.has(hostPort)) portMap.set(hostPort, []);
                    portMap.get(hostPort).push({ project: projectName, service: serviceName, mapping: port });
                }
            }

            // Volumes
            for (const vol of normalizeArray(service.volumes)) {
                const source = extractVolumeSource(vol);
                if (source) {
                    if (!volumeMap.has(source)) volumeMap.set(source, []);
                    volumeMap.get(source).push({ project: projectName, service: serviceName, mapping: vol });
                }
            }

            // Env files
            for (const envFile of normalizeArray(service.env_file)) {
                if (!envFileMap.has(envFile)) envFileMap.set(envFile, []);
                envFileMap.get(envFile).push({ project: projectName, service: serviceName });
            }
        }

        // Collect networks
        for (const networkName of Object.keys(content.networks || {})) {
            if (!networkMap.has(networkName)) networkMap.set(networkName, []);
            networkMap.get(networkName).push(projectName);
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
                // Host paths starting with . or / are potential conflicts
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
