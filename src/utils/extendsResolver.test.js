import { describe, it, expect } from 'vitest';
import {
    normalizeDependsOn,
    mergeServiceConfigs,
    resolveAllExtends
} from './extendsResolver';

describe('extendsResolver', () => {
    describe('normalizeDependsOn', () => {
        it('converts array to object format', () => {
            const result = normalizeDependsOn(['db', 'redis']);

            expect(result).toEqual({
                db: { condition: 'service_started' },
                redis: { condition: 'service_started' }
            });
        });

        it('returns object as-is', () => {
            const input = {
                db: { condition: 'service_healthy' },
                redis: { condition: 'service_started' }
            };

            expect(normalizeDependsOn(input)).toEqual(input);
        });

        it('handles empty input', () => {
            expect(normalizeDependsOn(null)).toEqual({});
            expect(normalizeDependsOn(undefined)).toEqual({});
        });
    });

    describe('mergeServiceConfigs', () => {
        it('concatenates port arrays (not replaces)', () => {
            const base = {
                image: 'node:20',
                ports: ['80:80']
            };
            const override = {
                ports: ['443:443', '8080:8080']
            };

            const result = mergeServiceConfigs(base, override);

            // Critical: Arrays should be CONCATENATED
            expect(result.ports).toEqual(['80:80', '443:443', '8080:8080']);
            expect(result.image).toBe('node:20');
        });

        it('concatenates volumes arrays', () => {
            const base = { volumes: ['./data:/data'] };
            const override = { volumes: ['./config:/config'] };

            const result = mergeServiceConfigs(base, override);

            expect(result.volumes).toEqual(['./data:/data', './config:/config']);
        });

        it('merges environment dictionaries', () => {
            const base = {
                environment: {
                    NODE_ENV: 'production',
                    PORT: '3000'
                }
            };
            const override = {
                environment: {
                    DEBUG: 'true',
                    PORT: '8080' // Should override
                }
            };

            const result = mergeServiceConfigs(base, override);

            expect(result.environment).toEqual({
                NODE_ENV: 'production',
                PORT: '8080', // Overridden
                DEBUG: 'true'
            });
        });

        it('overrides scalar values', () => {
            const base = {
                image: 'node:20',
                command: 'npm start'
            };
            const override = {
                image: 'node:22',
                user: '1000:1000'
            };

            const result = mergeServiceConfigs(base, override);

            expect(result.image).toBe('node:22'); // Overridden
            expect(result.command).toBe('npm start'); // Preserved
            expect(result.user).toBe('1000:1000'); // Added
        });

        it('normalizes depends_on before merging', () => {
            const base = {
                depends_on: ['db']
            };
            const override = {
                depends_on: ['redis']
            };

            const result = mergeServiceConfigs(base, override);

            // Both should be normalized to objects and merged
            expect(result.depends_on).toEqual({
                db: { condition: 'service_started' },
                redis: { condition: 'service_started' }
            });
        });

        it('merges depends_on when already objects', () => {
            const base = {
                depends_on: {
                    db: { condition: 'service_healthy' }
                }
            };
            const override = {
                depends_on: {
                    redis: { condition: 'service_started' }
                }
            };

            const result = mergeServiceConfigs(base, override);

            expect(result.depends_on).toEqual({
                db: { condition: 'service_healthy' },
                redis: { condition: 'service_started' }
            });
        });

        it('deep merges nested objects', () => {
            const base = {
                deploy: {
                    resources: {
                        limits: { cpus: '0.5' }
                    }
                }
            };
            const override = {
                deploy: {
                    resources: {
                        reservations: { memory: '256M' }
                    },
                    replicas: 3
                }
            };

            const result = mergeServiceConfigs(base, override);

            expect(result.deploy).toEqual({
                resources: {
                    limits: { cpus: '0.5' },
                    reservations: { memory: '256M' }
                },
                replicas: 3
            });
        });
    });

    describe('resolveAllExtends', () => {
        it('resolves simple extends', () => {
            const compose = {
                services: {
                    base: {
                        image: 'node:20',
                        environment: { NODE_ENV: 'production' }
                    },
                    app: {
                        extends: 'base',
                        ports: ['3000:3000']
                    }
                }
            };

            const result = resolveAllExtends(compose);

            expect(result.services.app).toEqual({
                image: 'node:20',
                environment: { NODE_ENV: 'production' },
                ports: ['3000:3000']
            });
            // Extends field should be removed
            expect(result.services.app.extends).toBeUndefined();
        });

        it('resolves chain of extends', () => {
            const compose = {
                services: {
                    base: {
                        image: 'node:20',
                        ports: ['80:80']
                    },
                    middleware: {
                        extends: 'base',
                        environment: { NODE_ENV: 'production' },
                        ports: ['443:443']
                    },
                    app: {
                        extends: 'middleware',
                        ports: ['8080:8080']
                    }
                }
            };

            const result = resolveAllExtends(compose);

            // All ports should be concatenated from the chain
            expect(result.services.app.ports).toEqual(['80:80', '443:443', '8080:8080']);
            expect(result.services.app.image).toBe('node:20');
            expect(result.services.app.environment).toEqual({ NODE_ENV: 'production' });
        });

        it('detects circular extends', () => {
            const compose = {
                services: {
                    a: { extends: 'b' },
                    b: { extends: 'c' },
                    c: { extends: 'a' } // Circular!
                }
            };

            expect(() => resolveAllExtends(compose)).toThrow(/circular/i);
        });

        it('throws error for missing extended service', () => {
            const compose = {
                services: {
                    app: { extends: 'nonexistent' }
                }
            };

            expect(() => resolveAllExtends(compose)).toThrow(/not found/i);
        });

        it('handles object-form extends', () => {
            const compose = {
                services: {
                    base: { image: 'nginx' },
                    app: {
                        extends: { service: 'base' },
                        ports: ['80:80']
                    }
                }
            };

            const result = resolveAllExtends(compose);

            expect(result.services.app.image).toBe('nginx');
            expect(result.services.app.ports).toEqual(['80:80']);
        });

        it('preserves services without extends', () => {
            const compose = {
                services: {
                    standalone: {
                        image: 'redis',
                        ports: ['6379:6379']
                    }
                }
            };

            const result = resolveAllExtends(compose);

            expect(result.services.standalone).toEqual({
                image: 'redis',
                ports: ['6379:6379']
            });
        });
    });
});
