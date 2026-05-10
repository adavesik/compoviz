/**
 * Healthcheck Analyzer
 *
 * Main entry point for healthcheck intelligence analysis.
 * Orchestrates detection rules and produces findings compatible
 * with the existing suggestion system.
 */

import { hasHealthcheck, getDependents } from '../models/astQueries.js';
import { normalizeTestCommand, getRecommendedHealthcheck, FAKE_PATTERNS, WEAK_INDICATORS } from './healthcheckPatterns.js';
import { SuggestionCategory, SuggestionSeverity } from './suggestionConstants.js';

/**
 * Severity ordering for sorting findings (critical first).
 */
const SEVERITY_ORDER = {
    [SuggestionSeverity.CRITICAL]: 0,
    [SuggestionSeverity.HIGH]: 1,
    [SuggestionSeverity.MEDIUM]: 2,
    [SuggestionSeverity.LOW]: 3,
    [SuggestionSeverity.INFO]: 4,
};

/**
 * Determine if a service should be excluded from healthcheck analysis.
 * Excludes:
 * - Services with restart: "no" (one-off/batch services)
 * - Services without a restart policy that have a command in _raw (one-off/batch)
 *
 * @param {object} service - A ServiceNode from the AST
 * @returns {boolean} True if the service should be excluded
 */
export function isExcludedFromAnalysis(service) {
    if (service.restart === 'no') return true;

    // One-off/batch services: no restart policy and has a command in _raw
    if (!service.restart && service._raw && service._raw.command) return true;

    return false;
}

/**
 * Sort findings by severity (critical first, info last).
 *
 * @param {Array} findings - Array of HealthcheckFinding objects
 * @returns {Array} Sorted findings array
 */
export function sortBySeverity(findings) {
    return findings.slice().sort((a, b) => {
        const orderA = SEVERITY_ORDER[a.severity] ?? 5;
        const orderB = SEVERITY_ORDER[b.severity] ?? 5;
        return orderA - orderB;
    });
}

/**
 * Add a finding to the findings array with deduplication.
 * Prevents duplicate findings for the same service+rule combination.
 *
 * @param {Array} findings - Findings array to append to
 * @param {Set} seen - Set of already-seen dedup keys
 * @param {object|null} finding - The finding to add (null is ignored)
 */
function addFinding(findings, seen, finding) {
    if (!finding) return;
    const key = `${finding.name}-${finding.rule}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
}

/**
 * Detect services that are missing healthchecks.
 * Excludes one-off/batch services. Severity is based on service role:
 * database/cache/queue → high, others → medium.
 *
 * @param {object} ast - The ComposeAST
 * @returns {Array} Array of HealthcheckFinding objects
 */
export function detectMissingHealthchecks(ast) {
    if (!ast || !ast.services) return [];

    const findings = [];

    for (const service of ast.services) {
        if (isExcludedFromAnalysis(service)) continue;
        if (hasHealthcheck(service)) continue;

        const role = service.classification?.role;
        const isInfraRole = role === 'database' || role === 'cache' || role === 'queue';
        const severity = isInfraRole ? SuggestionSeverity.HIGH : SuggestionSeverity.MEDIUM;

        const recommended = getRecommendedHealthcheck(service);

        findings.push({
            id: `${service.id}-missing-healthcheck`,
            type: 'suggestion',
            category: SuggestionCategory.ARCHITECTURE,
            severity,
            entity: 'service',
            name: service.id,
            message: 'No healthcheck configured. Service health cannot be monitored by Docker or dependent services.',
            rule: 'missing-healthcheck',
            action: recommended ? {
                type: 'add-healthcheck',
                value: { test: ['CMD-SHELL', recommended] }
            } : null,
            context: {
                recommendedCommand: recommended,
            }
        });
    }

    return findings;
}

/**
 * Truncate a string to a maximum length, appending "..." if truncated.
 *
 * @param {string} str - The string to truncate
 * @param {number} maxLen - Maximum length before truncation
 * @returns {string} Truncated string
 */
function truncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str || '';
    return str.slice(0, maxLen) + '...';
}

/**
 * Detect fake healthchecks that provide no real verification.
 * Matches healthcheck test commands against known fake patterns
 * (sleep, exit 0, true, /bin/true, echo).
 *
 * @param {object} ast - The ComposeAST
 * @returns {Array} Array of HealthcheckFinding objects
 */
export function detectFakeHealthchecks(ast) {
    if (!ast || !ast.services) return [];

    const findings = [];

    for (const service of ast.services) {
        if (isExcludedFromAnalysis(service)) continue;
        if (!hasHealthcheck(service)) continue;

        const command = normalizeTestCommand(service.healthcheck.test);
        if (!command) continue;

        for (const pattern of FAKE_PATTERNS) {
            if (pattern.test(command)) {
                const recommended = getRecommendedHealthcheck(service);

                findings.push({
                    id: `${service.id}-fake-healthcheck`,
                    type: 'suggestion',
                    category: SuggestionCategory.ARCHITECTURE,
                    severity: SuggestionSeverity.HIGH,
                    entity: 'service',
                    name: service.id,
                    message: `Healthcheck "${truncate(command, 40)}" provides no real verification. This is equivalent to having no healthcheck at all.`,
                    rule: 'fake-healthcheck',
                    action: recommended ? {
                        type: 'replace-healthcheck',
                        value: { test: ['CMD-SHELL', recommended] }
                    } : null,
                    context: {
                        currentCommand: command,
                        recommendedCommand: recommended,
                    }
                });
                break; // Only one finding per service
            }
        }
    }

    return findings;
}

/**
 * Parse a Docker duration string to seconds.
 * Supports formats like "30s", "1m", "1m30s", "2h", "2h30m", etc.
 * Returns null for null/undefined/empty input.
 *
 * @param {string|null|undefined} str - Duration string
 * @returns {number|null} Duration in seconds, or null if unparseable
 */
function parseDuration(str) {
    if (str == null || str === '') return null;

    const s = String(str).trim();
    if (!s) return null;

    let total = 0;
    let matched = false;

    const hourMatch = s.match(/(\d+)\s*h/);
    if (hourMatch) {
        total += parseInt(hourMatch[1], 10) * 3600;
        matched = true;
    }

    const minMatch = s.match(/(\d+)\s*m(?!s)/);
    if (minMatch) {
        total += parseInt(minMatch[1], 10) * 60;
        matched = true;
    }

    const secMatch = s.match(/(\d+)\s*s/);
    if (secMatch) {
        total += parseInt(secMatch[1], 10);
        matched = true;
    }

    return matched ? total : null;
}

/**
 * Detect weak healthchecks that exist but are poorly configured.
 * Checks for:
 * - Overly long intervals (>60s)
 * - Too few retries (1)
 * - Very short timeouts (<3s)
 * - Missing start_period for slow-starting services (database/cache)
 *
 * Severity is medium for a single weak indicator, high for multiple.
 * Skips services with fake healthchecks (those are flagged separately).
 *
 * @param {object} ast - The ComposeAST
 * @returns {Array} Array of HealthcheckFinding objects
 */
export function detectWeakHealthchecks(ast) {
    if (!ast || !ast.services) return [];

    const findings = [];

    for (const service of ast.services) {
        if (isExcludedFromAnalysis(service)) continue;
        if (!hasHealthcheck(service)) continue;

        // Skip fake healthchecks — they are flagged by detectFakeHealthchecks
        const command = normalizeTestCommand(service.healthcheck.test);
        if (command) {
            let isFake = false;
            for (const pattern of FAKE_PATTERNS) {
                if (pattern.test(command)) {
                    isFake = true;
                    break;
                }
            }
            if (isFake) continue;
        }

        const indicators = [];

        // Check interval > 60s
        const interval = parseDuration(service.healthcheck.interval);
        if (interval !== null && interval > WEAK_INDICATORS.longInterval) {
            indicators.push('interval too long (>60s)');
        }

        // Check retries === 1
        if (service.healthcheck.retries === WEAK_INDICATORS.lowRetries) {
            indicators.push('only 1 retry');
        }

        // Check timeout < 3s
        const timeout = parseDuration(service.healthcheck.timeout);
        if (timeout !== null && timeout < WEAK_INDICATORS.shortTimeout) {
            indicators.push('timeout too short (<3s)');
        }

        // Check missing start_period on slow-starting services (database/cache)
        const role = service.classification?.role;
        const isSlowStarting = role === 'database' || role === 'cache';
        if (isSlowStarting && !service.healthcheck.start_period) {
            indicators.push('missing start_period for slow-starting service');
        }

        if (indicators.length === 0) continue;

        findings.push({
            id: `${service.id}-weak-healthcheck`,
            type: 'suggestion',
            category: SuggestionCategory.BEST_PRACTICE,
            severity: indicators.length > 1 ? SuggestionSeverity.HIGH : SuggestionSeverity.MEDIUM,
            entity: 'service',
            name: service.id,
            message: `Healthcheck has weak configuration: ${indicators.join(', ')}.`,
            rule: 'weak-healthcheck',
            action: null,
            context: {
                indicators,
                currentCommand: normalizeTestCommand(service.healthcheck.test),
            }
        });
    }

    return findings;
}

/**
 * Get the names of all services that depend on a given service.
 *
 * @param {object} ast - The ComposeAST
 * @param {string} serviceId - The service to find dependents for
 * @returns {string[]} Array of service IDs that depend on the given service
 */
function getDependentNames(ast, serviceId) {
    return getDependents(ast, serviceId).map(s => s.id);
}

/**
 * Detect dependency race risks caused by inadequate health gating.
 *
 * Checks for:
 * - `impossible-healthy`: service_healthy condition on a service without a healthcheck (critical)
 * - `critical-path-no-healthcheck`: service_started on a service with ≥2 dependents and no healthcheck (high)
 * - `upgrade-to-healthy`: service_started when the dependency has a healthcheck (medium)
 *
 * @param {object} ast - The ComposeAST
 * @returns {Array} Array of HealthcheckFinding objects
 */
export function detectDependencyRaceRisks(ast) {
    if (!ast || !ast.services) return [];

    const findings = [];

    // Build reverse dependency count (how many services depend on each)
    const dependentCount = new Map();
    for (const service of ast.services) {
        for (const dep of service.dependencies) {
            dependentCount.set(dep.service, (dependentCount.get(dep.service) || 0) + 1);
        }
    }

    for (const service of ast.services) {
        for (const dep of service.dependencies) {
            const depService = ast.serviceMap.get(dep.service);
            if (!depService) continue;

            const depHasHealthcheck = hasHealthcheck(depService);
            const isCriticalPath = (dependentCount.get(dep.service) || 0) >= 2;

            if (dep.condition === 'service_healthy' && !depHasHealthcheck) {
                // IMPOSSIBLE: waiting for healthy on service with no healthcheck
                findings.push({
                    id: `${service.id}-impossible-healthy-${dep.service}`,
                    type: 'suggestion',
                    category: SuggestionCategory.ARCHITECTURE,
                    severity: SuggestionSeverity.CRITICAL,
                    entity: 'service',
                    name: service.id,
                    message: `Depends on "${dep.service}" with condition "service_healthy", but "${dep.service}" has no healthcheck. This service will never start.`,
                    rule: 'impossible-healthy',
                    action: null,
                    context: {
                        affectedServices: [service.id, dep.service],
                        dependencyChain: [service.id, dep.service],
                    }
                });
            } else if (dep.condition === 'service_started' && !depHasHealthcheck && isCriticalPath) {
                // HIGH RISK: critical-path service with no healthcheck
                const recommended = getRecommendedHealthcheck(depService);
                findings.push({
                    id: `${service.id}-race-risk-${dep.service}`,
                    type: 'suggestion',
                    category: SuggestionCategory.ARCHITECTURE,
                    severity: SuggestionSeverity.HIGH,
                    entity: 'service',
                    name: dep.service,
                    message: `"${dep.service}" is a critical dependency (${dependentCount.get(dep.service)} services depend on it) but has no healthcheck. Dependents may start before it's ready.`,
                    rule: 'critical-path-no-healthcheck',
                    action: recommended ? {
                        type: 'add-healthcheck',
                        value: { test: ['CMD-SHELL', recommended] },
                    } : null,
                    context: {
                        affectedServices: getDependentNames(ast, dep.service),
                        dependencyChain: [service.id, dep.service],
                    }
                });
            } else if (dep.condition === 'service_started' && depHasHealthcheck) {
                // MEDIUM: healthcheck exists but not being used
                findings.push({
                    id: `${service.id}-upgrade-condition-${dep.service}`,
                    type: 'suggestion',
                    category: SuggestionCategory.BEST_PRACTICE,
                    severity: SuggestionSeverity.MEDIUM,
                    entity: 'service',
                    name: service.id,
                    message: `"${dep.service}" has a healthcheck but "${service.id}" only waits for container start. Upgrade to "service_healthy" for reliable startup ordering.`,
                    rule: 'upgrade-to-healthy',
                    action: {
                        type: 'upgrade-condition',
                        value: { depends_on: { [dep.service]: { condition: 'service_healthy' } } }
                    },
                    context: {
                        dependencyChain: [service.id, dep.service],
                    }
                });
            }
        }
    }

    return findings;
}

/**
 * Analyze healthcheck quality across all services in a ComposeAST.
 *
 * Orchestrates detection rules, deduplicates findings, and returns
 * results sorted by severity (critical first).
 *
 * @param {object} ast - The normalized ComposeAST
 * @returns {Array} Array of HealthcheckFinding objects
 */
export function analyzeHealthchecks(ast) {
    // Handle null/undefined/invalid input
    if (!ast || !ast.services) return [];

    const findings = [];
    const seen = new Set(); // dedup key: `${service}-${rule}`

    // Phase 1: Per-service rules (each detector scans all services once)
    for (const f of detectMissingHealthchecks(ast)) addFinding(findings, seen, f);
    for (const f of detectFakeHealthchecks(ast)) addFinding(findings, seen, f);
    for (const f of detectWeakHealthchecks(ast)) addFinding(findings, seen, f);

    // Phase 2: Cross-service dependency analysis
    for (const f of detectDependencyRaceRisks(ast)) addFinding(findings, seen, f);

    // Phase 3: Sort by severity
    return sortBySeverity(findings);
}
