import { normalizeToAST } from '../models/normalizeToAST.js';
import { getEffectiveImage, getOrphanedVolumes, hasHealthcheck, hasResourceLimits } from '../models/astQueries.js';
import { MountTypes, DependencyConditions } from '../models/ComposeAST.js';

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
 * Generate suggestions for a compose state.
 * Uses the canonical AST for normalized reads, _raw for spec-compliance checks.
 * @param {object} state - The compose state
 * @returns {Array<object>} Array of suggestions
 */
export const generateSuggestions = (state) => {
    const suggestions = [];
    const ast = normalizeToAST(state);

    // Analyze each service
    for (const service of ast.services) {
        suggestions.push(...analyzeService(service, ast));
    }

    // Analyze orphaned volumes
    const orphaned = getOrphanedVolumes(ast);
    for (const vol of orphaned) {
        suggestions.push({
            id: `${vol.id}-unused-volume`,
            type: 'suggestion',
            category: SuggestionCategory.BEST_PRACTICE,
            severity: SuggestionSeverity.LOW,
            entity: 'volume',
            name: vol.id,
            message: 'Volume is defined but not used by any service. Consider removing it.',
            action: {
                type: 'delete-resource',
                entity: 'volume',
                name: vol.id,
            },
        });
    }

    return suggestions;
};

/**
 * Analyze a service and generate suggestions
 */
const analyzeService = (service, ast) => {
    const suggestions = [];
    const name = service.id;
    const raw = service._raw || {};

    // Rule 1: Missing restart policy (CRITICAL)
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

    // Rule 2: Invalid depends_on fields (spec-compliance — must read _raw)
    const rawDependsOn = raw.depends_on;
    if (rawDependsOn && typeof rawDependsOn === 'object' && !Array.isArray(rawDependsOn)) {
        Object.entries(rawDependsOn).forEach(([depName, depConfig]) => {
            if (depConfig && typeof depConfig === 'object') {
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
    const effectiveImage = getEffectiveImage(service);
    if (effectiveImage && effectiveImage.includes(':latest')) {
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
    if (!hasHealthcheck(service) && service.restart && !isOneoffService(service)) {
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
    if (service.privileged) {
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
    if (!hasResourceLimits(service)) {
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

    // Rule 8: Weak dependency condition (uses AST dependencies + checks dep service healthcheck)
    for (const dep of service.dependencies) {
        if (dep.condition === DependencyConditions.STARTED) {
            const depService = ast.serviceMap.get(dep.service);
            if (depService && !hasHealthcheck(depService)) {
                // Only flag if the condition was explicitly set in long syntax
                // (short syntax always defaults to service_started — don't flag those)
                const rawDeps = raw.depends_on;
                if (rawDeps && typeof rawDeps === 'object' && !Array.isArray(rawDeps) && rawDeps[dep.service]) {
                    suggestions.push({
                        id: `${name}-weak-depends-condition-${dep.service}`,
                        type: 'suggestion',
                        category: SuggestionCategory.ARCHITECTURE,
                        severity: SuggestionSeverity.LOW,
                        entity: 'service',
                        name,
                        message: `Using "service_started" for "${dep.service}" only waits for container start, not readiness. Consider adding a healthcheck and using "service_healthy".`,
                        action: null,
                    });
                }
            }
        }
    }

    // Rule 9: Secrets in environment variables (uses AST's pre-normalized environment object)
    if (Object.keys(service.environment).length > 0) {
        const sensitivePatterns = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL'];
        const envEntries = Object.entries(service.environment).map(([k, v]) => `${k}=${v}`);

        const hasSensitive = envEntries.some(envStr =>
            sensitivePatterns.some(pattern => envStr.toUpperCase().includes(pattern))
        );

        if (hasSensitive) {
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
        }
    }

    // Rule 10: Database service with bind mounts and no user config
    if (isDatabaseService(service) && hasBindMountAST(service) && !hasUserConfig(service)) {
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
    const prodBindMounts = service.volumes.filter(v =>
        v.type === MountTypes.BIND && isProductionDataTarget(v.target)
    );
    if (prodBindMounts.length > 0) {
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

// ─── Helpers (now operate on AST ServiceNode) ───────────────────────────────

/**
 * Check if service has user configuration (user field or PUID/PGID env vars)
 */
const hasUserConfig = (service) => {
    if (service.user) return true;

    const env = service.environment;
    if (!env || Object.keys(env).length === 0) return false;

    const envStr = Object.keys(env).join('|').toUpperCase();
    return envStr.includes('PUID') || envStr.includes('PGID') ||
        envStr.includes('UID') || envStr.includes('GID');
};

/**
 * Check if service is database or data-heavy service (uses AST classification + image)
 */
const isDatabaseService = (service) => {
    const image = (getEffectiveImage(service) || '').toLowerCase();
    const dbPatterns = [
        'postgres', 'mysql', 'mariadb', 'mongo', 'redis', 'elasticsearch',
        'cassandra', 'influxdb', 'timescale', 'cockroach',
        'plex', 'jellyfin', 'audiobookshelf', 'calibre', 'photoprism'
    ];
    return dbPatterns.some(pattern => image.includes(pattern));
};

/**
 * Check if service has any bind mounts (from AST volumes)
 */
const hasBindMountAST = (service) => {
    return service.volumes.some(v => v.type === MountTypes.BIND);
};

/**
 * Check if volume target path looks like production data
 */
const isProductionDataTarget = (target) => {
    if (!target) return false;
    const prodPaths = [
        '/var/lib/postgresql', '/var/lib/mysql', '/var/lib/mongodb',
        '/data', '/storage', '/media', '/library'
    ];
    return prodPaths.some(path => target.startsWith(path));
};

/**
 * Check if service is a one-off/batch job
 */
const isOneoffService = (service) => {
    return service.restart === 'no' || (!service.restart && service._raw?.command);
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
