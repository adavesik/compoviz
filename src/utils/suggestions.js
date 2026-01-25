import { normalizeArray } from './validation';

/**
 * Suggestion categories
 */
export const SuggestionCategory = {
    SECURITY: 'security',
    PERFORMANCE: 'performance',
    ARCHITECTURE: 'architecture',
    BEST_PRACTICE: 'best-practice',
    SPEC_COMPLIANCE: 'spec-compliance',
};

/**
 * Suggestion severity levels
 */
export const SuggestionSeverity = {
    INFO: 'info',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
};

/**
 * Generate suggestions for a compose state
 * @param {object} state - The compose state
 * @returns {Array<object>} Array of suggestions
 */
export const generateSuggestions = (state) => {
    const suggestions = [];

    // Analyze each service
    Object.entries(state.services || {}).forEach(([name, svc]) => {
        suggestions.push(...analyzeService(name, svc, state));
    });

    // Analyze volumes
    Object.entries(state.volumes || {}).forEach(([name, vol]) => {
        suggestions.push(...analyzeVolume(name, vol, state));
    });

    return suggestions;
};

/**
 * Analyze a service and generate suggestions
 */
const analyzeService = (name, service, state) => {
    const suggestions = [];

    // Rule 1: Missing restart policy (CRITICAL - catches Jellyfin issue)
    if (!service.restart) {
        suggestions.push({
            id: `${name}-missing-restart`,
            type: 'suggestion',
            category: SuggestionCategory.ARCHITECTURE,
            severity: SuggestionSeverity.CRITICAL,
            entity: 'service',
            name,
            message: 'Missing restart policy. Service will not auto-start after container daemon restarts or system reboots.',
            action: {
                type: 'add-field',
                field: 'restart',
                value: 'unless-stopped',
            },
        });
    }

    // Rule 2: Invalid depends_on fields (catches Jellyfin compose error)
    if (service.depends_on && typeof service.depends_on === 'object' && !Array.isArray(service.depends_on)) {
        Object.entries(service.depends_on).forEach(([depName, depConfig]) => {
            if (depConfig && typeof depConfig === 'object') {
                // Check for invalid 'restart' field
                if ('restart' in depConfig) {
                    suggestions.push({
                        id: `${name}-invalid-depends-on-restart`,
                        type: 'suggestion',
                        category: SuggestionCategory.SPEC_COMPLIANCE,
                        severity: SuggestionSeverity.MEDIUM,
                        entity: 'service',
                        name,
                        message: `Invalid field 'restart' in depends_on for "${depName}". This field does not exist in the Compose spec.`,
                        action: {
                            type: 'remove-field',
                            field: `depends_on.${depName}.restart`,
                        },
                    });
                }
            }
        });
    }

    // Rule 3: Using 'latest' image tag
    if (service.image && service.image.includes(':latest')) {
        suggestions.push({
            id: `${name}-latest-tag`,
            type: 'suggestion',
            category: SuggestionCategory.BEST_PRACTICE,
            severity: SuggestionSeverity.LOW,
            entity: 'service',
            name,
            message: 'Using "latest" tag can cause unexpected behavior. Consider pinning to a specific version.',
            action: null,
        });
    }

    // Rule 4: Missing health check for long-running services
    if (!service.healthcheck && service.restart && !isOneoffService(service)) {
        suggestions.push({
            id: `${name}-missing-healthcheck`,
            type: 'suggestion',
            category: SuggestionCategory.PERFORMANCE,
            severity: SuggestionSeverity.LOW,
            entity: 'service',
            name,
            message: 'Consider adding a health check to improve dependency management and container orchestration.',
            action: null,
        });
    }

    // Rule 5: Running as root (missing user configuration)
    if (!hasUserConfig(service) && !service.privileged) {
        suggestions.push({
            id: `${name}-no-user`,
            type: 'suggestion',
            category: SuggestionCategory.SECURITY,
            severity: SuggestionSeverity.HIGH,
            entity: 'service',
            name,
            message: 'No user configuration detected. Consider adding "user" field or PUID/PGID environment variables (e.g., PUID=1000, PGID=1000).',
            action: null,
        });
    }

    // Rule 6: Privileged containers
    if (service.privileged === true) {
        suggestions.push({
            id: `${name}-privileged`,
            type: 'suggestion',
            category: SuggestionCategory.SECURITY,
            severity: SuggestionSeverity.HIGH,
            entity: 'service',
            name,
            message: 'Running in privileged mode grants extensive permissions. Consider using specific capabilities instead.',
            action: null,
        });
    }

    // Rule 7: Missing resource limits
    if (!service.deploy?.resources?.limits) {
        suggestions.push({
            id: `${name}-no-resource-limits`,
            type: 'suggestion',
            category: SuggestionCategory.PERFORMANCE,
            severity: SuggestionSeverity.LOW,
            entity: 'service',
            name,
            message: 'Consider adding resource limits (memory/CPU) to prevent resource exhaustion.',
            action: null,
        });
    }

    // Rule 8: Weak dependency condition
    if (service.depends_on && typeof service.depends_on === 'object' && !Array.isArray(service.depends_on)) {
        Object.entries(service.depends_on).forEach(([depName, depConfig]) => {
            if (depConfig && depConfig.condition === 'service_started') {
                const depService = state.services?.[depName];
                if (depService && !depService.healthcheck) {
                    suggestions.push({
                        id: `${name}-weak-depends-condition-${depName}`,
                        type: 'suggestion',
                        category: SuggestionCategory.ARCHITECTURE,
                        severity: SuggestionSeverity.LOW,
                        entity: 'service',
                        name,
                        message: `Using "service_started" for "${depName}" only waits for container start, not readiness. Consider adding a healthcheck and using "service_healthy".`,
                        action: null,
                    });
                }
            }
        });
    }

    // Rule 9: Secrets in environment variables
    if (service.environment) {
        const envArray = Array.isArray(service.environment)
            ? service.environment
            : Object.entries(service.environment).map(([k, v]) => `${k}=${v}`);

        const sensitivePatterns = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL'];
        envArray.forEach((envVar) => {
            const envStr = typeof envVar === 'string' ? envVar : JSON.stringify(envVar);
            if (sensitivePatterns.some(pattern => envStr.toUpperCase().includes(pattern))) {
                suggestions.push({
                    id: `${name}-secrets-in-env`,
                    type: 'suggestion',
                    category: SuggestionCategory.SECURITY,
                    severity: SuggestionSeverity.MEDIUM,
                    entity: 'service',
                    name,
                    message: 'Sensitive data detected in environment variables. Consider using Docker secrets instead.',
                    action: null,
                });
                return;
            }
        });
    }

    // Rule 10: Database service with bind mounts and no user config
    if (isDatabaseService(service) && hasBindMount(service) && !hasUserConfig(service)) {
        suggestions.push({
            id: `${name}-db-bindmount-no-user`,
            type: 'suggestion',
            category: SuggestionCategory.BEST_PRACTICE,
            severity: SuggestionSeverity.MEDIUM,
            entity: 'service',
            name,
            message: 'Database/media service using bind mounts without user configuration. This commonly causes permission issues. Consider adding PUID/PGID environment variables or using named volumes.',
            action: null,
        });
    }

    // Rule 11: Production data paths on bind mounts
    const bindMounts = (service.volumes || []).filter(v => isBindMount(v));
    const prodDataMounts = bindMounts.filter(v => isProductionDataPath(v));
    if (prodDataMounts.length > 0) {
        suggestions.push({
            id: `${name}-prod-data-bindmount`,
            type: 'suggestion',
            category: SuggestionCategory.BEST_PRACTICE,
            severity: SuggestionSeverity.LOW,
            entity: 'service',
            name,
            message: 'Using bind mounts for production data paths. Consider named volumes for better portability, backups, and Docker-managed lifecycle.',
            action: null,
        });
    }

    return suggestions;
};

/**
 * Analyze a volume and generate suggestions
 */
const analyzeVolume = (name, volume, state) => {
    const suggestions = [];

    // Rule 10: Unused volumes
    const isUsed = Object.values(state.services || {}).some(svc => {
        const volumes = normalizeArray(svc.volumes);
        return volumes.some(vol => {
            const volName = typeof vol === 'string' ? vol.split(':')[0] : vol.source;
            return volName === name;
        });
    });

    if (!isUsed) {
        suggestions.push({
            id: `${name}-unused-volume`,
            type: 'suggestion',
            category: SuggestionCategory.BEST_PRACTICE,
            severity: SuggestionSeverity.LOW,
            entity: 'volume',
            name,
            message: 'Volume is defined but not used by any service. Consider removing it.',
            action: {
                type: 'delete-resource',
                entity: 'volume',
                name,
            },
        });
    }

    return suggestions;
};

/**
 * Helper: Check if service has user configuration (user field or PUID/PGID env vars)
 */
const hasUserConfig = (service) => {
    // Check for explicit user field
    if (service.user) return true;

    // Check for PUID/PGID environment variables (Linuxserver.io pattern)
    const env = service.environment;
    if (!env) return false;

    // Convert to array of strings for checking
    const envArray = Array.isArray(env)
        ? env.map(e => typeof e === 'string' ? e : JSON.stringify(e))
        : Object.keys(env);

    const envStr = envArray.join('|').toUpperCase();
    return envStr.includes('PUID') || envStr.includes('PGID') ||
        envStr.includes('UID') || envStr.includes('GID');
};

/**
 * Helper: Check if volume mount is a bind mount (not named volume)
 */
const isBindMount = (volumeStr) => {
    if (typeof volumeStr !== 'string') return false;
    const source = volumeStr.split(':')[0];
    // Bind mount = absolute or relative path
    return source.startsWith('/') || source.startsWith('.') || source.startsWith('~');
};

/**
 * Helper: Check if service is database or data-heavy service
 */
const isDatabaseService = (service) => {
    const image = service.image?.toLowerCase() || '';
    const dbPatterns = [
        'postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'elasticsearch',
        'cassandra', 'influxdb', 'timescale', 'cockroach',
        // Media/data services
        'plex', 'jellyfin', 'audiobookshelf', 'calibre', 'photoprism'
    ];
    return dbPatterns.some(pattern => image.includes(pattern));
};

/**
 * Helper: Check if service has any bind mounts
 */
const hasBindMount = (service) => {
    const volumes = service.volumes || [];
    return volumes.some(vol => isBindMount(vol));
};

/**
 * Helper: Check if volume path looks like production data
 */
const isProductionDataPath = (volumeStr) => {
    if (typeof volumeStr !== 'string') return false;
    const target = volumeStr.split(':')[1] || '';
    const prodPaths = [
        '/var/lib/postgresql', '/var/lib/mysql', '/var/lib/mongodb',
        '/data', '/storage', '/media', '/library'
    ];
    return prodPaths.some(path => target.startsWith(path));
};

/**
 * Helper: Check if service is a one-off/batch job
 */
const isOneoffService = (service) => {
    return service.restart === 'no' || (!service.restart && service.command);
};

/**
 * Get suggestion count by severity for a specific entity
 */
export const getSuggestionCounts = (suggestions, entityName) => {
    const filtered = suggestions.filter(s => s.name === entityName);
    return {
        total: filtered.length,
        critical: filtered.filter(s => s.severity === SuggestionSeverity.CRITICAL).length,
        high: filtered.filter(s => s.severity === SuggestionSeverity.HIGH).length,
        medium: filtered.filter(s => s.severity === SuggestionSeverity.MEDIUM).length,
        low: filtered.filter(s => s.severity === SuggestionSeverity.LOW).length,
        info: filtered.filter(s => s.severity === SuggestionSeverity.INFO).length,
    };
};

/**
 * Get highest severity for an entity
 */
export const getHighestSeverity = (suggestions, entityName) => {
    const counts = getSuggestionCounts(suggestions, entityName);
    if (counts.critical > 0) return SuggestionSeverity.CRITICAL;
    if (counts.high > 0) return SuggestionSeverity.HIGH;
    if (counts.medium > 0) return SuggestionSeverity.MEDIUM;
    if (counts.low > 0) return SuggestionSeverity.LOW;
    if (counts.info > 0) return SuggestionSeverity.INFO;
    return null;
};
