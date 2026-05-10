import { describe, it, expect } from 'vitest';
import {
    generateSuggestions,
    getSuggestionCounts,
    getHighestSeverity,
    SuggestionCategory,
    SuggestionSeverity,
} from './suggestions';

describe('generateSuggestions', () => {
    describe('Real-world Jellyfin/Tailscale case', () => {
        it('should detect all critical issues', () => {
            const state = {
                services: {
                    'TYH-jellyfin-host': {
                        image: 'tailscale/tailscale:latest',
                        restart: 'always',
                    },
                    jellyfin: {
                        image: 'jellyfin/jellyfin',
                        user: '1001:1001',
                        depends_on: {
                            'TYH-jellyfin-host': {
                                condition: 'service_started',
                                restart: true, // Invalid
                            },
                        },
                        // Missing restart!
                    },
                },
            };

            const suggestions = generateSuggestions(state);

            // Should detect missing restart on jellyfin
            const missingRestart = suggestions.find(s => s.id === 'jellyfin-missing-restart');
            expect(missingRestart).toBeDefined();
            expect(missingRestart.severity).toBe(SuggestionSeverity.CRITICAL);

            // Should detect invalid depends_on field
            const invalidDepends = suggestions.find(s => s.id === 'jellyfin-invalid-depends-on-restart');
            expect(invalidDepends).toBeDefined();
        });
    });

    describe('Helper functions', () => {
        it('should count suggestions by severity', () => {
            const suggestions = [
                { name: 'web', severity: SuggestionSeverity.CRITICAL },
                { name: 'web', severity: SuggestionSeverity.HIGH },
                { name: 'db', severity: SuggestionSeverity.MEDIUM },
            ];

            const counts = getSuggestionCounts(suggestions, 'web');
            expect(counts.total).toBe(2);
            expect(counts.critical).toBe(1);
        });

        it('should get highest severity', () => {
            const suggestions = [
                { name: 'web', severity: SuggestionSeverity.LOW },
                { name: 'web', severity: SuggestionSeverity.CRITICAL },
            ];

            const highest = getHighestSeverity(suggestions, 'web');
            expect(highest).toBe(SuggestionSeverity.CRITICAL);
        });
    });

    describe('Healthcheck intelligence integration', () => {
        it('should include healthcheck findings in generateSuggestions output', () => {
            const state = {
                services: {
                    postgres: {
                        image: 'postgres:15',
                        restart: 'always',
                    },
                },
            };

            const suggestions = generateSuggestions(state);

            const missingHC = suggestions.find(s => s.rule === 'missing-healthcheck' && s.name === 'postgres');
            expect(missingHC).toBeDefined();
            expect(missingHC.category).toBe(SuggestionCategory.ARCHITECTURE);
            expect(missingHC.severity).toBe(SuggestionSeverity.HIGH);
        });

        it('should not produce old Rule 4 shape (performance/low missing-healthcheck)', () => {
            const state = {
                services: {
                    postgres: {
                        image: 'postgres:15',
                        restart: 'always',
                    },
                },
            };

            const suggestions = generateSuggestions(state);

            // The old Rule 4 had category: 'performance', severity: 'low'
            const oldRule4 = suggestions.find(s =>
                s.id && s.id.endsWith('-missing-healthcheck') &&
                s.category === SuggestionCategory.PERFORMANCE &&
                s.severity === SuggestionSeverity.LOW
            );
            expect(oldRule4).toBeUndefined();

            // The new analyzer produces architecture/medium or architecture/high
            const newHC = suggestions.find(s => s.rule === 'missing-healthcheck');
            expect(newHC).toBeDefined();
            expect(newHC.category).toBe(SuggestionCategory.ARCHITECTURE);
            expect([SuggestionSeverity.MEDIUM, SuggestionSeverity.HIGH]).toContain(newHC.severity);
        });

        it('should detect multiple healthcheck issues in a real-world-like compose', () => {
            const state = {
                services: {
                    postgres: {
                        image: 'postgres:15',
                        restart: 'always',
                    },
                    redis: {
                        image: 'redis:7',
                        restart: 'always',
                        healthcheck: {
                            test: ['CMD-SHELL', 'sleep 5'],
                            interval: '30s',
                            timeout: '10s',
                            retries: 3,
                        },
                    },
                    web: {
                        image: 'myapp:latest',
                        restart: 'always',
                        user: '1000:1000',
                        depends_on: {
                            postgres: { condition: 'service_healthy' },
                        },
                    },
                },
            };

            const suggestions = generateSuggestions(state);

            // impossible-healthy: web depends on postgres with service_healthy but postgres has no healthcheck
            const impossibleHealthy = suggestions.find(s => s.rule === 'impossible-healthy');
            expect(impossibleHealthy).toBeDefined();
            expect(impossibleHealthy.severity).toBe(SuggestionSeverity.CRITICAL);

            // fake-healthcheck: redis has "sleep 5" as healthcheck
            const fakeHC = suggestions.find(s => s.rule === 'fake-healthcheck' && s.name === 'redis');
            expect(fakeHC).toBeDefined();
            expect(fakeHC.severity).toBe(SuggestionSeverity.HIGH);

            // missing-healthcheck: postgres has no healthcheck
            const missingHC = suggestions.find(s => s.rule === 'missing-healthcheck' && s.name === 'postgres');
            expect(missingHC).toBeDefined();
        });

        it('should merge healthcheck findings with existing suggestion rules', () => {
            const state = {
                services: {
                    postgres: {
                        image: 'postgres:15',
                        restart: 'always',
                        // No user → triggers no-user rule
                        // No healthcheck → triggers missing-healthcheck
                    },
                    web: {
                        image: 'myapp:latest',
                        // No restart → triggers missing-restart
                        // No user → triggers no-user rule
                    },
                },
            };

            const suggestions = generateSuggestions(state);

            // Existing rules should still fire
            const missingRestart = suggestions.find(s => s.id === 'web-missing-restart');
            expect(missingRestart).toBeDefined();

            const noUser = suggestions.find(s => s.id === 'postgres-no-user');
            expect(noUser).toBeDefined();

            // Healthcheck rules should also fire
            const missingHC = suggestions.find(s => s.rule === 'missing-healthcheck' && s.name === 'postgres');
            expect(missingHC).toBeDefined();

            // Total count should include both types
            const totalCount = suggestions.length;
            const healthcheckFindings = suggestions.filter(s =>
                s.rule === 'missing-healthcheck' || s.rule === 'fake-healthcheck' ||
                s.rule === 'weak-healthcheck' || s.rule === 'impossible-healthy' ||
                s.rule === 'critical-path-no-healthcheck' || s.rule === 'upgrade-to-healthy'
            );
            const existingFindings = suggestions.filter(s => !healthcheckFindings.includes(s));

            expect(healthcheckFindings.length).toBeGreaterThan(0);
            expect(existingFindings.length).toBeGreaterThan(0);
            expect(totalCount).toBe(healthcheckFindings.length + existingFindings.length);
        });
    });
});
