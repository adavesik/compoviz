import { extractHostPort } from './comparison';

/**
 * Helper to normalize depends_on (can be array or object in Docker Compose).
 * @param {Array|object} dependsOn - The depends_on value.
 * @returns {string[]} Normalized array of service names.
 */
export const normalizeDependsOn = (dependsOn) => {
    if (!dependsOn) return [];
    if (Array.isArray(dependsOn)) return dependsOn;
    if (typeof dependsOn === 'object') return Object.keys(dependsOn);
    return [];
};

/**
 * Helper to normalize arrays that might be objects or undefined.
 * @param {any} arr - The value to normalize.
 * @returns {any[]} A normalized array.
 */
export const normalizeArray = (arr) => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr;
    return [];
};

/**
 * Validates the compose state and returns an array of errors/warnings.
 * @param {object} state - The compose state.
 * @returns {Array<{type: string, entity: string, name: string, message: string}>} Array of validation issues.
 */
export const validateState = (state) => {
    const errors = [];
    const usedPorts = new Map(); // Track port usage for duplicate detection
    const containerNames = new Set();

    Object.entries(state.services || {}).forEach(([name, svc]) => {
        // Check for image or build
        if (!svc.image && !svc.build) {
            errors.push({ type: 'error', entity: 'service', name, message: 'Missing image or build context' });
        }

        // Check for duplicate container names
        if (svc.container_name) {
            if (containerNames.has(svc.container_name)) {
                errors.push({ type: 'error', entity: 'service', name, message: `Duplicate container_name "${svc.container_name}"` });
            } else {
                containerNames.add(svc.container_name);
            }
        }

        // Check network references
        normalizeArray(svc.networks).forEach(n => {
            if (!state.networks || !state.networks[n]) {
                errors.push({ type: 'warning', entity: 'service', name, message: `Network "${n}" not defined` });
            }
        });

        // Check dependency references
        normalizeDependsOn(svc.depends_on).forEach(d => {
            if (!state.services || !state.services[d]) {
                errors.push({ type: 'error', entity: 'service', name, message: `Dependency "${d}" not found` });
            }
        });

        // Check volume references (named volumes only)
        normalizeArray(svc.volumes).forEach(vol => {
            const volName = typeof vol === 'string' ? vol.split(':')[0] : '';
            // Only check if it looks like a named volume (not a path)
            if (volName && !volName.startsWith('.') && !volName.startsWith('/') && state.volumes && !state.volumes[volName]) {
                errors.push({ type: 'warning', entity: 'service', name, message: `Volume "${volName}" not defined` });
            }
        });

        // Check for port conflicts
        normalizeArray(svc.ports).forEach(port => {
            const hostBinding = extractHostPort(port);
            if (hostBinding) {
                if (usedPorts.has(hostBinding)) {
                    errors.push({ type: 'error', entity: 'service', name, message: `Port binding ${hostBinding} already used by "${usedPorts.get(hostBinding)}"` });
                } else {
                    usedPorts.set(hostBinding, name);
                }
            }
        });
    });

    return errors;
};
