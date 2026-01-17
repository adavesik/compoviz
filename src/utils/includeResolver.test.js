import { describe, it, expect } from 'vitest';
import { resolveIncludes, hasIncludes } from './includeResolver';

describe('includeResolver', () => {
    describe('hasIncludes', () => {
        it('returns true for array includes', () => {
            const compose = {
                include: ['./base.yml', './override.yml']
            };

            expect(hasIncludes(compose)).toBe(true);
        });

        it('returns true for single include', () => {
            const compose = {
                include: './base.yml'
            };

            expect(hasIncludes(compose)).toBe(true);
        });

        it('returns false for empty includes', () => {
            expect(hasIncludes({ include: [] })).toBe(false);
            expect(hasIncludes({})).toBe(false);
            expect(hasIncludes(null)).toBe(false);
        });
    });

    describe('resolveIncludes', () => {
        it('resolves simple include', () => {
            const main = {
                name: 'my-project',
                include: './base.yml',
                services: {
                    app: { image: 'app:latest' }
                }
            };

            const fileMap = {
                'docker-compose.yml': 'name: my-project\ninclude: ./base.yml\nservices:\n  app:\n    image: app:latest',
                'base.yml': 'services:\n  db:\n    image: postgres:15'
            };

            const result = resolveIncludes(main, 'docker-compose.yml', fileMap);

            expect(result.services.app).toBeDefined();
            expect(result.services.db).toBeDefined();
            expect(result.include).toBeUndefined();
        });

        it('resolves multiple includes', () => {
            const main = {
                include: ['./base.yml', './override.yml'],
                services: {
                    app: { image: 'app:latest' }
                }
            };

            const fileMap = {
                'docker-compose.yml': 'include:\n  - ./base.yml\n  - ./override.yml\nservices:\n  app:\n    image: app:latest',
                'base.yml': 'services:\n  db:\n    image: postgres:15',
                'override.yml': 'services:\n  cache:\n    image: redis:7'
            };

            const result = resolveIncludes(main, 'docker-compose.yml', fileMap);

            expect(result.services.app).toBeDefined();
            expect(result.services.db).toBeDefined();
            expect(result.services.cache).toBeDefined();
            expect(result.include).toBeUndefined();
        });

        it('throws error for missing include file', () => {
            const main = {
                include: './missing.yml'
            };

            const fileMap = {
                'docker-compose.yml': ''
            };

            expect(() => {
                resolveIncludes(main, 'docker-compose.yml', fileMap);
            }).toThrow(/not found/i);
        });

        it('throws error for circular includes', () => {
            const fileA = {
                include: './b.yml',
                services: { a: {} }
            };

            const fileMap = {
                'a.yml': 'include: ./b.yml\nservices:\n  a: {}',
                'b.yml': 'include: ./a.yml\nservices:\n  b: {}'
            };

            expect(() => {
                resolveIncludes(fileA, 'a.yml', fileMap);
            }).toThrow(/circular/i);
        });

        it('handles complex relative paths', () => {
            const main = {
                include: '../backend/api.yml'
            };

            const fileMap = {
                'frontend/docker-compose.yml': ' ',
                'backend/api.yml': 'services:\n  api:\n    image: api:latest'
            };

            const result = resolveIncludes(main, 'frontend/docker-compose.yml', fileMap);

            expect(result).toBeDefined();
            expect(result.services).toBeDefined();
            expect(result.services.api).toBeDefined();
            expect(result.services.api.image).toBe('api:latest');
        });

        it('merges services from includes', () => {
            const main = {
                include: './base.yml',
                services: {
                    app: {
                        image: 'app:latest',
                        ports: ['3000:3000']
                    }
                }
            };

            const fileMap = {
                'docker-compose.yml': 'include: ./base.yml\nservices:\n  app:\n    image: app:latest\n    ports:\n      - "3000:3000"',
                'base.yml': 'services:\n  app:\n    image: app:1.0.0\n    environment:\n      NODE_ENV: production\n  db:\n    image: postgres:15'
            };

            const result = resolveIncludes(main, 'docker-compose.yml', fileMap);

            // Main overrides base
            expect(result.services).toBeDefined();
            expect(result.services.app).toBeDefined();
            expect(result.services.app.image).toBe('app:latest');
            expect(result.services.app.ports).toEqual(['3000:3000']);
            // But base's db is preserved
            expect(result.services.db).toBeDefined();
        });

        it('handles object-form include specification', () => {
            const main = {
                include: [
                    { path: './base.yml' }
                ]
            };

            const fileMap = {
                'docker-compose.yml': 'include:\n  - path: ./base.yml',
                'base.yml': 'services:\n  db:\n    image: postgres:15'
            };

            const result = resolveIncludes(main, 'docker-compose.yml', fileMap);

            expect(result.services).toBeDefined();
            expect(result.services.db).toBeDefined();
            expect(result.services.db.image).toBe('postgres:15');
        });

        it('preserves compose without includes', () => {
            const main = {
                services: {
                    app: { image: 'app:latest' }
                }
            };

            const result = resolveIncludes(main, 'docker-compose.yml', {});

            expect(result).toEqual(main);
        });
    });
});
