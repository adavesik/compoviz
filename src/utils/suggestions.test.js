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
});
