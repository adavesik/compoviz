import { describe, it, expect } from 'vitest';
import {
    analyzeHealthchecks,
    detectMissingHealthchecks,
    detectFakeHealthchecks,
    detectWeakHealthchecks,
    detectDependencyRaceRisks,
    isExcludedFromAnalysis,
    sortBySeverity,
} from './healthcheckAnalyzer';
import { SuggestionSeverity } from './suggestions';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createAST(services) {
    const serviceNodes = services.map(s => ({
        id: s.id,
        image: s.image || null,
        restart: s.restart || null,
        healthcheck: s.healthcheck || null,
        dependencies: s.dependencies || [],
        classification: s.classification || { tier: 'application', role: 'application', icon: '📦' },
        runtime: s.runtime || { resolvedImage: null, resolvedPorts: [], enriched: false },
        _raw: s._raw || {},
        volumes: s.volumes || [],
        ports: s.ports || [],
        networks: s.networks || [],
        environment: s.environment || {},
        secrets: s.secrets || [],
        configs: s.configs || [],
        profiles: s.profiles || [],
        envFiles: s.envFiles || [],
        build: s.build || null,
        containerName: s.containerName || null,
        user: s.user || null,
        privileged: s.privileged || false,
        labels: s.labels || {},
        deploy: s.deploy || null,
    }));
    return {
        _version: '1.0.0',
        name: 'test',
        services: serviceNodes,
        networks: [],
        volumes: [],
        secrets: [],
        configs: [],
        serviceMap: new Map(serviceNodes.map(s => [s.id, s])),
        networkMap: new Map(),
        volumeMap: new Map(),
    };
}

function createHealthcheck(test, opts = {}) {
    return {
        test,
        interval: opts.interval || null,
        timeout: opts.timeout || null,
        retries: opts.retries ?? null,
        start_period: opts.start_period || null,
        disabled: opts.disabled || false,
    };
}

// ─── detectMissingHealthchecks ──────────────────────────────────────────────

describe('detectMissingHealthchecks', () => {
    it('produces a finding for a service without a healthcheck', () => {
        const ast = createAST([
            { id: 'web', restart: 'always' },
        ]);
        const findings = detectMissingHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].name).toBe('web');
        expect(findings[0].rule).toBe('missing-healthcheck');
    });

    it('produces no finding for a service with a healthcheck', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'curl -f http://localhost/']),
            },
        ]);
        const findings = detectMissingHealthchecks(ast);
        expect(findings).toHaveLength(0);
    });

    it('excludes services with restart: "no" (one-off services)', () => {
        const ast = createAST([
            { id: 'migrate', restart: 'no' },
        ]);
        const findings = detectMissingHealthchecks(ast);
        expect(findings).toHaveLength(0);
    });

    it('excludes services without restart but with _raw.command (one-off/batch)', () => {
        const ast = createAST([
            { id: 'seed', _raw: { command: 'npm run seed' } },
        ]);
        const findings = detectMissingHealthchecks(ast);
        expect(findings).toHaveLength(0);
    });

    it('assigns HIGH severity to database services without healthcheck', () => {
        const ast = createAST([
            {
                id: 'postgres',
                restart: 'always',
                image: 'postgres:15',
                classification: { tier: 'persistence', role: 'database', icon: '🐘' },
            },
        ]);
        const findings = detectMissingHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe(SuggestionSeverity.HIGH);
    });

    it('assigns MEDIUM severity to application services without healthcheck', () => {
        const ast = createAST([
            {
                id: 'api',
                restart: 'always',
                classification: { tier: 'application', role: 'application', icon: '📦' },
            },
        ]);
        const findings = detectMissingHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe(SuggestionSeverity.MEDIUM);
    });

    it('includes recommended command for known images (postgres)', () => {
        const ast = createAST([
            {
                id: 'db',
                restart: 'always',
                image: 'postgres:15',
                classification: { tier: 'persistence', role: 'database', icon: '🐘' },
            },
        ]);
        const findings = detectMissingHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].action).not.toBeNull();
        expect(findings[0].context.recommendedCommand).toContain('pg_isready');
    });
});

// ─── detectFakeHealthchecks ─────────────────────────────────────────────────

describe('detectFakeHealthchecks', () => {
    it('detects "sleep 5" as a fake healthcheck', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'sleep 5']),
            },
        ]);
        const findings = detectFakeHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].rule).toBe('fake-healthcheck');
        expect(findings[0].name).toBe('web');
    });

    it('detects "exit 0" as a fake healthcheck', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'exit 0']),
            },
        ]);
        const findings = detectFakeHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].rule).toBe('fake-healthcheck');
    });

    it('detects "true" as a fake healthcheck', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'true']),
            },
        ]);
        const findings = detectFakeHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].rule).toBe('fake-healthcheck');
    });

    it('does not flag a legitimate healthcheck command', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'curl -f http://localhost/']),
            },
        ]);
        const findings = detectFakeHealthchecks(ast);
        expect(findings).toHaveLength(0);
    });

    it('does not flag a service without a healthcheck', () => {
        const ast = createAST([
            { id: 'web', restart: 'always' },
        ]);
        const findings = detectFakeHealthchecks(ast);
        expect(findings).toHaveLength(0);
    });
});

// ─── detectWeakHealthchecks ─────────────────────────────────────────────────

describe('detectWeakHealthchecks', () => {
    it('detects interval too long (>60s)', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'curl -f http://localhost/'], {
                    interval: '90s',
                }),
            },
        ]);
        const findings = detectWeakHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].rule).toBe('weak-healthcheck');
        expect(findings[0].context.indicators).toContain('interval too long (>60s)');
    });

    it('detects only 1 retry', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'curl -f http://localhost/'], {
                    retries: 1,
                }),
            },
        ]);
        const findings = detectWeakHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].context.indicators).toContain('only 1 retry');
    });

    it('detects timeout too short (<3s)', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'curl -f http://localhost/'], {
                    timeout: '2s',
                }),
            },
        ]);
        const findings = detectWeakHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].context.indicators).toContain('timeout too short (<3s)');
    });

    it('detects missing start_period for database services', () => {
        const ast = createAST([
            {
                id: 'db',
                restart: 'always',
                image: 'postgres:15',
                classification: { tier: 'persistence', role: 'database', icon: '🐘' },
                healthcheck: createHealthcheck(['CMD-SHELL', 'pg_isready']),
            },
        ]);
        const findings = detectWeakHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].context.indicators).toContain('missing start_period for slow-starting service');
    });

    it('assigns HIGH severity for multiple weak indicators', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'curl -f http://localhost/'], {
                    interval: '90s',
                    retries: 1,
                }),
            },
        ]);
        const findings = detectWeakHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe(SuggestionSeverity.HIGH);
    });

    it('assigns MEDIUM severity for a single weak indicator', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'curl -f http://localhost/'], {
                    interval: '90s',
                }),
            },
        ]);
        const findings = detectWeakHealthchecks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].severity).toBe(SuggestionSeverity.MEDIUM);
    });

    it('does not flag a service with a fake healthcheck (avoids double-flagging)', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'exit 0'], {
                    interval: '90s',
                }),
            },
        ]);
        const findings = detectWeakHealthchecks(ast);
        expect(findings).toHaveLength(0);
    });
});

// ─── detectDependencyRaceRisks ──────────────────────────────────────────────

describe('detectDependencyRaceRisks', () => {
    it('detects impossible-healthy (service_healthy on service without healthcheck)', () => {
        const ast = createAST([
            { id: 'db', restart: 'always' },
            {
                id: 'web',
                restart: 'always',
                dependencies: [{ service: 'db', condition: 'service_healthy' }],
            },
        ]);
        const findings = detectDependencyRaceRisks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].rule).toBe('impossible-healthy');
        expect(findings[0].severity).toBe(SuggestionSeverity.CRITICAL);
        expect(findings[0].name).toBe('web');
    });

    it('detects critical-path-no-healthcheck (service_started on service with ≥2 dependents, no healthcheck)', () => {
        const ast = createAST([
            { id: 'db', restart: 'always' },
            {
                id: 'web',
                restart: 'always',
                dependencies: [{ service: 'db', condition: 'service_started' }],
            },
            {
                id: 'worker',
                restart: 'always',
                dependencies: [{ service: 'db', condition: 'service_started' }],
            },
        ]);
        const findings = detectDependencyRaceRisks(ast);
        const criticalPath = findings.filter(f => f.rule === 'critical-path-no-healthcheck');
        expect(criticalPath.length).toBeGreaterThanOrEqual(1);
        expect(criticalPath[0].severity).toBe(SuggestionSeverity.HIGH);
        expect(criticalPath[0].name).toBe('db');
    });

    it('detects upgrade-to-healthy (service_started when dep has healthcheck)', () => {
        const ast = createAST([
            {
                id: 'db',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'pg_isready']),
            },
            {
                id: 'web',
                restart: 'always',
                dependencies: [{ service: 'db', condition: 'service_started' }],
            },
        ]);
        const findings = detectDependencyRaceRisks(ast);
        expect(findings).toHaveLength(1);
        expect(findings[0].rule).toBe('upgrade-to-healthy');
        expect(findings[0].severity).toBe(SuggestionSeverity.MEDIUM);
    });

    it('gracefully skips dependency targets not in serviceMap', () => {
        const ast = createAST([
            {
                id: 'web',
                restart: 'always',
                dependencies: [{ service: 'nonexistent', condition: 'service_healthy' }],
            },
        ]);
        const findings = detectDependencyRaceRisks(ast);
        expect(findings).toHaveLength(0);
    });
});

// ─── analyzeHealthchecks (main entry point) ─────────────────────────────────

describe('analyzeHealthchecks', () => {
    it('returns empty array for null input', () => {
        expect(analyzeHealthchecks(null)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
        expect(analyzeHealthchecks(undefined)).toEqual([]);
    });

    it('returns empty array for AST with empty services', () => {
        const ast = createAST([]);
        expect(analyzeHealthchecks(ast)).toEqual([]);
    });

    it('deduplicates: service without healthcheck never gets both missing AND fake/weak findings', () => {
        const ast = createAST([
            { id: 'web', restart: 'always' },
        ]);
        const findings = analyzeHealthchecks(ast);
        const webFindings = findings.filter(f => f.name === 'web');
        const rules = webFindings.map(f => f.rule);

        // Should have missing-healthcheck but NOT fake or weak
        if (rules.includes('missing-healthcheck')) {
            expect(rules).not.toContain('fake-healthcheck');
            expect(rules).not.toContain('weak-healthcheck');
        }
    });

    it('results are sorted by severity (critical first)', () => {
        const ast = createAST([
            { id: 'db', restart: 'always' },
            {
                id: 'web',
                restart: 'always',
                dependencies: [{ service: 'db', condition: 'service_healthy' }],
            },
            {
                id: 'api',
                restart: 'always',
                healthcheck: createHealthcheck(['CMD-SHELL', 'curl -f http://localhost/'], {
                    interval: '90s',
                }),
            },
        ]);
        const findings = analyzeHealthchecks(ast);

        // Verify sorted order: critical ≤ high ≤ medium ≤ low ≤ info
        const severityOrder = {
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
            info: 4,
        };

        for (let i = 1; i < findings.length; i++) {
            const prev = severityOrder[findings[i - 1].severity] ?? 5;
            const curr = severityOrder[findings[i].severity] ?? 5;
            expect(prev).toBeLessThanOrEqual(curr);
        }
    });

    it('produces findings for a realistic multi-service compose', () => {
        const ast = createAST([
            {
                id: 'postgres',
                restart: 'always',
                image: 'postgres:15',
                classification: { tier: 'persistence', role: 'database', icon: '🐘' },
            },
            {
                id: 'redis',
                restart: 'always',
                image: 'redis:7',
                classification: { tier: 'persistence', role: 'cache', icon: '⚡' },
                healthcheck: createHealthcheck(['CMD-SHELL', 'sleep 5']),
            },
            {
                id: 'web',
                restart: 'always',
                dependencies: [
                    { service: 'postgres', condition: 'service_healthy' },
                    { service: 'redis', condition: 'service_started' },
                ],
            },
        ]);
        const findings = analyzeHealthchecks(ast);

        // Should detect: impossible-healthy (web→postgres), fake (redis), missing (postgres)
        const rules = findings.map(f => f.rule);
        expect(rules).toContain('impossible-healthy');
        expect(rules).toContain('fake-healthcheck');
        expect(rules).toContain('missing-healthcheck');
    });
});

// ─── isExcludedFromAnalysis ─────────────────────────────────────────────────

describe('isExcludedFromAnalysis', () => {
    it('excludes services with restart: "no"', () => {
        const service = { restart: 'no', _raw: {} };
        expect(isExcludedFromAnalysis(service)).toBe(true);
    });

    it('excludes services without restart but with _raw.command', () => {
        const service = { restart: null, _raw: { command: 'npm run migrate' } };
        expect(isExcludedFromAnalysis(service)).toBe(true);
    });

    it('does not exclude services with restart: "always"', () => {
        const service = { restart: 'always', _raw: {} };
        expect(isExcludedFromAnalysis(service)).toBe(false);
    });

    it('does not exclude services with restart: "unless-stopped"', () => {
        const service = { restart: 'unless-stopped', _raw: {} };
        expect(isExcludedFromAnalysis(service)).toBe(false);
    });
});

// ─── sortBySeverity ─────────────────────────────────────────────────────────

describe('sortBySeverity', () => {
    it('sorts findings from critical to info', () => {
        const findings = [
            { severity: 'medium' },
            { severity: 'critical' },
            { severity: 'info' },
            { severity: 'high' },
            { severity: 'low' },
        ];
        const sorted = sortBySeverity(findings);
        expect(sorted.map(f => f.severity)).toEqual([
            'critical', 'high', 'medium', 'low', 'info',
        ]);
    });

    it('does not mutate the original array', () => {
        const findings = [{ severity: 'low' }, { severity: 'critical' }];
        const sorted = sortBySeverity(findings);
        expect(sorted).not.toBe(findings);
        expect(findings[0].severity).toBe('low');
    });
});
