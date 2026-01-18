/**
 * Docker Compose profile filter.
 * Filters services based on active profiles.
 */

/**
 * Extract all unique profiles from a compose configuration.
 * 
 * @param {Object} compose - Compose configuration
 * @returns {string[]} Array of unique profile names
 */
export function listAllProfiles(compose) {
    if (!compose || !compose.services) {
        return [];
    }

    const profiles = new Set();

    for (const service of Object.values(compose.services)) {
        const serviceProfiles = getServiceProfiles(service);
        serviceProfiles.forEach(profile => profiles.add(profile));
    }

    return Array.from(profiles).sort();
}

/**
 * Get profiles for a single service.
 * 
 * @param {Object} service - Service configuration
 * @returns {string[]} Array of profile names
 */
export function getServiceProfiles(service) {
    if (!service || !service.profiles) {
        return [];
    }

    // Profiles can be a single string or an array
    if (typeof service.profiles === 'string') {
        return [service.profiles];
    }

    if (Array.isArray(service.profiles)) {
        return service.profiles.filter(p => typeof p === 'string');
    }

    return [];
}

/**
 * Count services per profile before filtering.
 *
 * @param {Object} compose - Compose configuration
 * @returns {Object} Map of profile name to service count
 */
export function getProfileCounts(compose) {
    if (!compose || !compose.services) {
        return {};
    }

    const counts = {};

    for (const service of Object.values(compose.services)) {
        const serviceProfiles = getServiceProfiles(service);
        serviceProfiles.forEach((profile) => {
            counts[profile] = (counts[profile] || 0) + 1;
        });
    }

    return counts;
}

/**
 * Check if a service matches the active profiles.
 * 
 * Profile matching rules:
 * - Service with no profiles → always included
 * - Service with profiles → included only if at least one active profile matches
 * 
 * @param {Object} service - Service configuration
 * @param {string[]} activeProfiles - Array of active profile names
 * @returns {boolean} True if service should be included
 */
export function matchesProfiles(service, activeProfiles = []) {
    const serviceProfiles = getServiceProfiles(service);

    // Service has no profiles → always included
    if (serviceProfiles.length === 0) {
        return true;
    }

    // Check if at least one service profile is active
    return serviceProfiles.some(profile => activeProfiles && activeProfiles.includes(profile));
}

/**
 * Filter services in a compose configuration by active profiles.
 * 
 * @param {Object} compose - Compose configuration
 * @param {string[]} activeProfiles - Array of active profile names
 * @returns {Object} Filtered compose configuration
 */
export function filterByProfiles(compose, activeProfiles = []) {
    if (!compose) {
        return compose;
    }

    // If no services, return as-is
    if (!compose.services) {
        return compose;
    }

    // Filter services
    const filteredServices = {};

    for (const [name, service] of Object.entries(compose.services)) {
        if (matchesProfiles(service, activeProfiles)) {
            filteredServices[name] = service;
        }
    }

    return {
        ...compose,
        services: filteredServices
    };
}

/**
 * Get statistics about profile usage.
 * 
 * @param {Object} compose - Compose configuration
 * @returns {Object} Profile statistics
 */
export function getProfileStats(compose) {
    if (!compose || !compose.services) {
        return {
            totalServices: 0,
            profiledServices: 0,
            unProfiledServices: 0,
            profiles: []
        };
    }

    const services = Object.values(compose.services);
    const profiledServices = services.filter(s => getServiceProfiles(s).length > 0);

    return {
        totalServices: services.length,
        profiledServices: profiledServices.length,
        unProfiledServices: services.length - profiledServices.length,
        profiles: listAllProfiles(compose)
    };
}
