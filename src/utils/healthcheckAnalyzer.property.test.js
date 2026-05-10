import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analyzeHealthchecks, isExcludedFromAnalysis } from './healthcheckAnalyzer';

/**
 * Property-based tests for the Healthcheck Analyzer.
 * Uses fast-check to verify correctness properties across many random inputs.
 *
 * Validates: Design Correctness Property 1
 */

// ─── Generators ─────────────────────────────────────────────────────────────

/** Generate a valid service ID (lowercase, starts with letter) */
const arbServiceId = () =>
    fc.stringMatching(/^[a-z][a-z0-9_-]{0,14}$/).filter(s => s.length >= 1);

/** Generate a restart policy */
const arbRestart = () =>
    fc.oneof(
        fc.constant('always'),
        fc.constant('unless-stopped'),
        fc.constant('on-failure'),
        fc.constant('no'),
        fc.constant(null)
    );

/** Generate a service image */
const arbImage = () =>
    fc.oneof(
        fc.constant('myapp:latest'),
        fc.constant('postgres:15'),
        fc.constant('redis:7'),
        fc.constant('nginx:latest'),
        fc.constant('mongo:6'),
        fc.constant(null)
    );

/** Generate a classification role */
const arbRole = () =>
    fc.oneof(
        fc.constant('application'),
        fc.constant('database'),
        fc.constant('cache'),
        fc.constant('queue'),
        fc.constant('proxy')
    );

/** Generate a healthcheck object or null */
const arbHealthcheck = () =>
    fc.oneof(
        fc.constant(null),
        fc.record({
            test: fc.oneof(
                fc.constant(['CMD-SHELL', 'curl -f http://localhost/ || exit 1']),
                fc.constant(['CMD-SHELL', 'pg_isready']),
                fc.constant(['CMD-SHELL', 'redis-cli ping']),
                fc.constant(['CMD', 'curl', '-f', 'http://localhost/']),
                fc.constant(['CMD-SHELL', 'sleep 5']),
                fc.constant(['CMD-SHELL', 'exit 0']),
                fc.constant(['CMD-SHELL', 'true'])
            ),
            interval: fc.oneof(fc.constant(null), fc.constant('30s'), fc.constant('90s')),
            timeout: fc.oneof(fc.constant(null), fc.constant('5s'), fc.constant('2s')),
            retries: fc.oneof(fc.constant(null), fc.constant(1), fc.constant(3), fc.constant(5)),
            start_period: fc.oneof(fc.constant(null), fc.constant('10s'), fc.constant('30s')),
            disabled: fc.constant(false),
        })
    );

/** Generate a _raw object (may or may not have command) */
const arbRaw = () =>
    fc.oneof(
        fc.constant({}),
        fc.constant({ command: 'npm run migrate' }),
        fc.constant({ command: 'python seed.py' }),
        fc.constant({ ports: ['8080:80'] })
    );

/** Generate a single service node */
const arbService = () =>
    fc.record({
        id: arbServiceId(),
        restart: arbRestart(),
        image: arbImage(),
        healthcheck: arbHealthcheck(),
        _raw: arbRaw(),
        role: arbRole(),
    }).map(({ id, restart, image, healthcheck, _raw, role }) => ({
        id,
        image,
        restart,
        healthcheck,
        dependencies: [],
        classification: { tier: 'application', role, icon: '📦' },
        runtime: { resolvedImage: null, resolvedPorts: [], enriched: false },
        _raw,
        volumes: [],
        ports: [],
        networks: [],
        environment: {},
        secrets: [],
        configs: [],
        profiles: [],
        envFiles: [],
        build: null,
        containerName: null,
        user: null,
        privileged: false,
        labels: {},
        deploy: null,
    }));

/** Generate an excluded service (restart: 'no' OR no restart + _raw.command) */
const arbExcludedService = () =>
    fc.record({
        id: arbServiceId(),
        image: arbImage(),
        role: arbRole(),
        variant: fc.oneof(fc.constant('restart-no'), fc.constant('one-off')),
        healthcheck: arbHealthcheck(),
    }).map(({ id, image, role, variant, healthcheck }) => {
        const restart = variant === 'restart-no' ? 'no' : null;
        const _raw = variant === 'one-off' ? { command: 'npm run seed' } : {};
        return {
            id,
            image,
            restart,
            healthcheck,
            dependencies: [],
            classification: { tier: 'application', role, icon: '📦' },
            runtime: { resolvedImage: null, resolvedPorts: [], enriched: false },
            _raw,
            volumes: [],
            ports: [],
            networks: [],
            environment: {},
            secrets: [],
            configs: [],
            profiles: [],
            envFiles: [],
            build: null,
            containerName: null,
            user: null,
            privileged: false,
            labels: {},
            deploy: null,
        };
    });

/** Generate a normal (non-excluded) service */
const arbNormalService = () =>
    fc.record({
        id: arbServiceId(),
        image: arbImage(),
        restart: fc.oneof(fc.constant('always'), fc.constant('unless-stopped'), fc.constant('on-failure')),
        healthcheck: arbHealthcheck(),
        role: arbRole(),
    }).map(({ id, image, restart, healthcheck, role }) => ({
        id,
        image,
        restart,
        healthcheck,
        dependencies: [],
        classification: { tier: 'application', role, icon: '📦' },
        runtime: { resolvedImage: null, resolvedPorts: [], enriched: false },
        _raw: {},
        volumes: [],
        ports: [],
        networks: [],
        environment: {},
        secrets: [],
        configs: [],
        profiles: [],
        envFiles: [],
        build: null,
        containerName: null,
        user: null,
        privileged: false,
        labels: {},
        deploy: null,
    }));

/** Build a valid AST from an array of service nodes, ensuring unique IDs */
function buildAST(services) {
    // Deduplicate by ID (keep first occurrence)
    const seen = new Set();
    const uniqueServices = [];
    for (const s of services) {
        if (!seen.has(s.id)) {
            seen.add(s.id);
            uniqueServices.push(s);
        }
    }
    return {
        _version: '1.0.0',
        name: 'test',
        services: uniqueServices,
        networks: [],
        volumes: [],
        secrets: [],
        configs: [],
        serviceMap: new Map(uniqueServices.map(s => [s.id, s])),
        networkMap: new Map(),
        volumeMap: new Map(),
    };
}

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Healthcheck Analyzer - Property-Based Tests', () => {
    /**
     * Property 1: No false positives on excluded services
     *
     * For any generated AST with a mix of excluded (restart: "no" or one-off)
     * and normal services, excluded services never appear in findings for
     * missing-healthcheck, weak-healthcheck, or fake-healthcheck rules.
     *
     * **Validates: Requirements 1.2**
     */
    describe('Property 1: No false positives on excluded services', () => {
        it('excluded services never appear in missing/weak/fake findings', () => {
            fc.assert(
                fc.property(
                    fc.tuple(
                        fc.array(arbExcludedService(), { minLength: 1, maxLength: 5 }),
                        fc.array(arbNormalService(), { minLength: 0, maxLength: 5 })
                    ),
                    ([excludedServices, normalServices]) => {
                        const allServices = [...excludedServices, ...normalServices];
                        const ast = buildAST(allServices);

                        // Identify which service IDs are actually excluded in the final AST
                        const excludedIds = new Set(
                            ast.services
                                .filter(s => isExcludedFromAnalysis(s))
                                .map(s => s.id)
                        );

                        const findings = analyzeHealthchecks(ast);

                        // Filter to per-service rules (not dependency race rules)
                        const perServiceRules = ['missing-healthcheck', 'weak-healthcheck', 'fake-healthcheck'];
                        const perServiceFindings = findings.filter(f => perServiceRules.includes(f.rule));

                        // Assert: no excluded service appears in per-service findings
                        for (const finding of perServiceFindings) {
                            expect(excludedIds.has(finding.name)).toBe(false);
                        }
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('services with restart "no" are always excluded regardless of other properties', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        id: arbServiceId(),
                        image: arbImage(),
                        healthcheck: arbHealthcheck(),
                        role: arbRole(),
                        raw: arbRaw(),
                    }),
                    ({ id, image, healthcheck, role, raw }) => {
                        const service = {
                            id,
                            image,
                            restart: 'no',
                            healthcheck,
                            dependencies: [],
                            classification: { tier: 'application', role, icon: '📦' },
                            runtime: { resolvedImage: null, resolvedPorts: [], enriched: false },
                            _raw: raw,
                            volumes: [],
                            ports: [],
                            networks: [],
                            environment: {},
                            secrets: [],
                            configs: [],
                            profiles: [],
                            envFiles: [],
                            build: null,
                            containerName: null,
                            user: null,
                            privileged: false,
                            labels: {},
                            deploy: null,
                        };

                        // The service should always be excluded
                        expect(isExcludedFromAnalysis(service)).toBe(true);

                        // And it should never appear in per-service findings
                        const ast = buildAST([service]);
                        const findings = analyzeHealthchecks(ast);
                        const perServiceRules = ['missing-healthcheck', 'weak-healthcheck', 'fake-healthcheck'];
                        const perServiceFindings = findings.filter(f => perServiceRules.includes(f.rule));

                        for (const finding of perServiceFindings) {
                            expect(finding.name).not.toBe(id);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('one-off services (no restart + _raw.command) are always excluded', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        id: arbServiceId(),
                        image: arbImage(),
                        healthcheck: arbHealthcheck(),
                        role: arbRole(),
                        command: fc.oneof(
                            fc.constant('npm run migrate'),
                            fc.constant('python seed.py'),
                            fc.constant('./init.sh'),
                            fc.constant('node scripts/setup.js')
                        ),
                    }),
                    ({ id, image, healthcheck, role, command }) => {
                        const service = {
                            id,
                            image,
                            restart: null,
                            healthcheck,
                            dependencies: [],
                            classification: { tier: 'application', role, icon: '📦' },
                            runtime: { resolvedImage: null, resolvedPorts: [], enriched: false },
                            _raw: { command },
                            volumes: [],
                            ports: [],
                            networks: [],
                            environment: {},
                            secrets: [],
                            configs: [],
                            profiles: [],
                            envFiles: [],
                            build: null,
                            containerName: null,
                            user: null,
                            privileged: false,
                            labels: {},
                            deploy: null,
                        };

                        // The service should always be excluded
                        expect(isExcludedFromAnalysis(service)).toBe(true);

                        // And it should never appear in per-service findings
                        const ast = buildAST([service]);
                        const findings = analyzeHealthchecks(ast);
                        const perServiceRules = ['missing-healthcheck', 'weak-healthcheck', 'fake-healthcheck'];
                        const perServiceFindings = findings.filter(f => perServiceRules.includes(f.rule));

                        for (const finding of perServiceFindings) {
                            expect(finding.name).not.toBe(id);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});


/**
 * Property 2: Mutual exclusivity of missing vs quality rules
 *
 * For any service, the findings array never contains both a `missing-healthcheck`
 * finding and a `fake-healthcheck` or `weak-healthcheck` finding for the same service.
 *
 * **Validates: Design Correctness Property 2**
 */
describe('Property 2: Mutual exclusivity of missing vs quality rules', () => {
    it('no service has both missing-healthcheck and fake/weak-healthcheck findings', () => {
        fc.assert(
            fc.property(
                fc.array(arbService(), { minLength: 1, maxLength: 10 }),
                (services) => {
                    const ast = buildAST(services);
                    const findings = analyzeHealthchecks(ast);

                    // Group findings by service name
                    const byService = new Map();
                    for (const f of findings) {
                        if (!byService.has(f.name)) byService.set(f.name, []);
                        byService.get(f.name).push(f.rule);
                    }

                    // Assert mutual exclusivity
                    for (const [, rules] of byService) {
                        if (rules.includes('missing-healthcheck')) {
                            expect(rules).not.toContain('fake-healthcheck');
                            expect(rules).not.toContain('weak-healthcheck');
                        }
                    }
                }
            ),
            { numRuns: 200 }
        );
    });
});


/**
 * Property 3: Impossible-healthy is always critical
 *
 * For any AST where a service depends on another with `condition: 'service_healthy'`
 * and the dependency has no healthcheck, all resulting `impossible-healthy` findings
 * must have severity `critical`.
 *
 * **Validates: Design Correctness Property 3**
 */
describe('Property 3: Impossible-healthy is always critical', () => {
    it('all impossible-healthy findings have critical severity', () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    arbServiceId(),
                    arbServiceId().filter(id => id.length > 0),
                    arbImage(),
                    arbImage()
                ).filter(([a, b]) => a !== b),
                ([depId, serviceId, depImage, serviceImage]) => {
                    // Create a service that depends on another with service_healthy
                    // but the dependency has NO healthcheck
                    const depService = {
                        id: depId,
                        image: depImage,
                        restart: 'always',
                        healthcheck: null,
                        dependencies: [],
                        classification: { tier: 'application', role: 'application', icon: '📦' },
                        runtime: { resolvedImage: null, resolvedPorts: [], enriched: false },
                        _raw: {},
                        volumes: [], ports: [], networks: [], environment: {},
                        secrets: [], configs: [], profiles: [], envFiles: [],
                        build: null, containerName: null, user: null, privileged: false,
                        labels: {}, deploy: null,
                    };
                    const service = {
                        id: serviceId,
                        image: serviceImage,
                        restart: 'always',
                        healthcheck: null,
                        dependencies: [{ service: depId, condition: 'service_healthy' }],
                        classification: { tier: 'application', role: 'application', icon: '📦' },
                        runtime: { resolvedImage: null, resolvedPorts: [], enriched: false },
                        _raw: {},
                        volumes: [], ports: [], networks: [], environment: {},
                        secrets: [], configs: [], profiles: [], envFiles: [],
                        build: null, containerName: null, user: null, privileged: false,
                        labels: {}, deploy: null,
                    };

                    const ast = buildAST([depService, service]);
                    const findings = analyzeHealthchecks(ast);
                    const impossibleFindings = findings.filter(f => f.rule === 'impossible-healthy');

                    // There should be at least one impossible-healthy finding
                    expect(impossibleFindings.length).toBeGreaterThanOrEqual(1);

                    // All impossible-healthy findings must be critical
                    for (const f of impossibleFindings) {
                        expect(f.severity).toBe('critical');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * Property 6: Finding IDs are unique
 *
 * For any AST input, `analyzeHealthchecks(ast).map(f => f.id)` contains no duplicates.
 * This ensures the deduplication logic works correctly across all rule combinations.
 *
 * **Validates: Design Correctness Property 6**
 */
describe('Property 6: Finding IDs are unique', () => {
    it('all finding IDs are unique for any AST input', () => {
        fc.assert(
            fc.property(
                fc.array(arbService(), { minLength: 1, maxLength: 10 }),
                (services) => {
                    const ast = buildAST(services);
                    const findings = analyzeHealthchecks(ast);
                    const ids = findings.map(f => f.id);
                    const uniqueIds = new Set(ids);
                    expect(uniqueIds.size).toBe(ids.length);
                }
            ),
            { numRuns: 200 }
        );
    });
});


/**
 * Property 7 & 10: Output shape compatibility and deterministic output
 *
 * For any generated AST input:
 * - Every finding has all required fields (id, type, category, severity, entity, name, message)
 * - Running analysis twice on same input produces identical output
 *
 * **Validates: Design Correctness Properties 7, 10**
 */
describe('Property 7 & 10: Output shape compatibility and deterministic output', () => {
    it('every finding has all required fields', () => {
        fc.assert(
            fc.property(
                fc.array(arbService(), { minLength: 1, maxLength: 10 }),
                (services) => {
                    const ast = buildAST(services);
                    const findings = analyzeHealthchecks(ast);

                    for (const finding of findings) {
                        expect(finding).toHaveProperty('id');
                        expect(finding).toHaveProperty('type');
                        expect(finding).toHaveProperty('category');
                        expect(finding).toHaveProperty('severity');
                        expect(finding).toHaveProperty('entity');
                        expect(finding).toHaveProperty('name');
                        expect(finding).toHaveProperty('message');

                        // Type checks
                        expect(typeof finding.id).toBe('string');
                        expect(finding.type).toBe('suggestion');
                        expect(typeof finding.category).toBe('string');
                        expect(['info', 'low', 'medium', 'high', 'critical']).toContain(finding.severity);
                        expect(finding.entity).toBe('service');
                        expect(typeof finding.name).toBe('string');
                        expect(typeof finding.message).toBe('string');
                    }
                }
            ),
            { numRuns: 200 }
        );
    });

    it('running analysis twice on same input produces identical output', () => {
        fc.assert(
            fc.property(
                fc.array(arbService(), { minLength: 1, maxLength: 10 }),
                (services) => {
                    const ast = buildAST(services);
                    const findings1 = analyzeHealthchecks(ast);
                    const findings2 = analyzeHealthchecks(ast);

                    expect(findings1).toEqual(findings2);
                }
            ),
            { numRuns: 200 }
        );
    });
});


/**
 * Property 9: Empty AST produces empty findings
 *
 * For empty, null, undefined, or malformed AST inputs,
 * `analyzeHealthchecks` always returns an empty array.
 *
 * **Validates: Design Correctness Property 9**
 */
describe('Property 9: Empty AST produces empty findings', () => {
    it('empty AST (no services) produces empty findings', () => {
        const emptyAST = buildAST([]);
        expect(analyzeHealthchecks(emptyAST)).toEqual([]);
    });

    it('null input produces empty findings', () => {
        expect(analyzeHealthchecks(null)).toEqual([]);
    });

    it('undefined input produces empty findings', () => {
        expect(analyzeHealthchecks(undefined)).toEqual([]);
    });

    it('AST with missing services field produces empty findings', () => {
        expect(analyzeHealthchecks({})).toEqual([]);
    });

    it('AST with null services produces empty findings', () => {
        expect(analyzeHealthchecks({ services: null })).toEqual([]);
    });
});
