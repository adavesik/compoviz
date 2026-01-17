import { describe, it, expect } from 'vitest';
import {
    listAllProfiles,
    getServiceProfiles,
    matchesProfiles,
    filterByProfiles,
    getProfileStats
} from './profileFilter';

describe('profileFilter', () => {
    describe('getServiceProfiles', () => {
        it('returns empty array for service without profiles', () => {
            const service = { image: 'nginx' };
            expect(getServiceProfiles(service)).toEqual([]);
        });

        it('handles single profile as string', () => {
            const service = { image: 'nginx', profiles: 'dev' };
            expect(getServiceProfiles(service)).toEqual(['dev']);
        });

        it('handles multiple profiles as array', () => {
            const service = { image: 'nginx', profiles: ['dev', 'test'] };
            expect(getServiceProfiles(service)).toEqual(['dev', 'test']);
        });

        it('filters out non-string values', () => {
            const service = { image: 'nginx', profiles: ['dev', null, 'test', undefined] };
            expect(getServiceProfiles(service)).toEqual(['dev', 'test']);
        });
    });

    describe('listAllProfiles', () => {
        it('extracts all unique profiles', () => {
            const compose = {
                services: {
                    web: { profiles: ['dev', 'test'] },
                    db: { profiles: 'dev' },
                    cache: { profiles: ['prod', 'test'] }
                }
            };

            const profiles = listAllProfiles(compose);

            expect(profiles).toEqual(['dev', 'prod', 'test']);
        });

        it('returns empty array for compose without services', () => {
            expect(listAllProfiles({})).toEqual([]);
            expect(listAllProfiles(null)).toEqual([]);
        });

        it('ignores services without profiles', () => {
            const compose = {
                services: {
                    web: { profiles: 'dev' },
                    db: { image: 'postgres' }
                }
            };

            expect(listAllProfiles(compose)).toEqual(['dev']);
        });

        it('returns sorted profiles', () => {
            const compose = {
                services: {
                    a: { profiles: 'z' },
                    b: { profiles: 'a' },
                    c: { profiles: 'm' }
                }
            };

            expect(listAllProfiles(compose)).toEqual(['a', 'm', 'z']);
        });
    });

    describe('matchesProfiles', () => {
        it('includes service without profiles', () => {
            const service = { image: 'nginx' };
            expect(matchesProfiles(service, ['dev'])).toBe(true);
            expect(matchesProfiles(service, [])).toBe(true);
        });

        it('excludes services with profiles when no active profiles', () => {
            const service = { image: 'nginx', profiles: ['dev'] };
            expect(matchesProfiles(service, [])).toBe(false);
            expect(matchesProfiles(service, null)).toBe(false);
        });

        it('includes service when profile matches', () => {
            const service = { image: 'nginx', profiles: ['dev', 'test'] };
            expect(matchesProfiles(service, ['dev'])).toBe(true);
            expect(matchesProfiles(service, ['test'])).toBe(true);
            expect(matchesProfiles(service, ['dev', 'prod'])).toBe(true);
        });

        it('excludes service when no profile matches', () => {
            const service = { image: 'nginx', profiles: ['dev'] };
            expect(matchesProfiles(service, ['prod'])).toBe(false);
            expect(matchesProfiles(service, ['test', 'prod'])).toBe(false);
        });
    });

    describe('filterByProfiles', () => {
        it('excludes services with profiles when no active profiles', () => {
            const compose = {
                services: {
                    web: { profiles: 'dev' },
                    db: { profiles: 'prod' },
                    cache: { image: 'redis' }
                }
            };

            const result = filterByProfiles(compose, []);

            expect(Object.keys(result.services)).toEqual(['cache']);
        });

        it('filters services by active profile', () => {
            const compose = {
                services: {
                    web: { profiles: 'dev' },
                    db: { profiles: 'prod' },
                    cache: { image: 'redis' }
                }
            };

            const result = filterByProfiles(compose, ['dev']);

            expect(Object.keys(result.services)).toEqual(['web', 'cache']);
        });

        it('includes service with multiple matching profiles', () => {
            const compose = {
                services: {
                    web: { profiles: ['dev', 'test'] },
                    db: { profiles: 'prod' }
                }
            };

            const result = filterByProfiles(compose, ['test']);

            expect(Object.keys(result.services)).toEqual(['web']);
        });

        it('preserves services without profiles', () => {
            const compose = {
                services: {
                    web: { image: 'nginx', profiles: 'dev' },
                    db: { image: 'postgres' }
                }
            };

            const result = filterByProfiles(compose, ['prod']);

            expect(Object.keys(result.services)).toEqual(['db']);
        });

        it('preserves other compose fields', () => {
            const compose = {
                name: 'my-project',
                services: {
                    web: { profiles: 'dev' }
                },
                networks: {
                    default: {}
                }
            };

            const result = filterByProfiles(compose, ['dev']);

            expect(result.name).toBe('my-project');
            expect(result.networks).toEqual({ default: {} });
        });

        it('handles empty compose', () => {
            expect(filterByProfiles(null, ['dev'])).toBe(null);
            expect(filterByProfiles({}, ['dev'])).toEqual({});
        });
    });

    describe('getProfileStats', () => {
        it('calculates profile statistics', () => {
            const compose = {
                services: {
                    web: { profiles: 'dev' },
                    db: { profiles: ['dev', 'prod'] },
                    cache: { image: 'redis' },
                    queue: { image: 'rabbitmq' }
                }
            };

            const stats = getProfileStats(compose);

            expect(stats).toEqual({
                totalServices: 4,
                profiledServices: 2,
                unProfiledServices: 2,
                profiles: ['dev', 'prod']
            });
        });

        it('handles empty compose', () => {
            const stats = getProfileStats({});

            expect(stats).toEqual({
                totalServices: 0,
                profiledServices: 0,
                unProfiledServices: 0,
                profiles: []
            });
        });
    });
});
