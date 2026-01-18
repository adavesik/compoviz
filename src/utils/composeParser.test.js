import { describe, it, expect } from 'vitest';
import { parseCompose, parseYaml, validateCompose } from './composeParser';

describe('composeParser', () => {
    describe('parseCompose', () => {
        it('parses simple compose file', () => {
            const yaml = `
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
`;

            const result = parseCompose(yaml);

            expect(result.compose).toBeDefined();
            expect(result.compose.services.web).toBeDefined();
            expect(result.compose.services.web.image).toBe('nginx:latest');
            expect(result.errors).toHaveLength(0);
        });

        it('interpolates variables', () => {
            const yaml = `
services:
  web:
    image: nginx:\${VERSION:-latest}
    ports:
      - "\${PORT}:80"
`;

            const result = parseCompose(yaml, {
                environment: { PORT: '3000', VERSION: '1.0' },
                enableVariables: true,
                addMetadata: false
            });

            expect(result.compose.services.web.image).toBe('nginx:1.0');
            expect(result.compose.services.web.ports).toEqual(['3000:80']);
        });

        it('warns about undefined variables', () => {
            const yaml = `
services:
  web:
    image: nginx:\${UNDEFINED_VAR}
`;

            const result = parseCompose(yaml, {
                environment: {},
                enableVariables: true
            });

            expect(result.undefinedVariables).toContain('UNDEFINED_VAR');
            expect(result.errors.some(e => e.type === 'warning')).toBe(true);
        });

        it('interpolates defaults even when required variables are missing', () => {
            const yaml = `
services:
  web:
    image: nginx
    ports:
      - "\${WEB_PORT:-80}:80"
    environment:
      SECRET: "\${REQUIRED:?required}"
`;

            const result = parseCompose(yaml, {
                environment: {},
                enableVariables: true
            });

            expect(result.compose.services.web.ports).toEqual(['80:80']);
            const variableError = result.errors.find(e => e.type === 'variable');
            expect(variableError).toBeDefined();
        });

        it('filters by profiles', () => {
            const yaml = `
services:
  web:
    image: nginx
  dev-tools:
    image: tools
    profiles:
      - dev
  prod-cache:
    image: redis
    profiles:
      - prod
`;

            const result = parseCompose(yaml, {
                activeProfiles: ['dev'],
                enableProfiles: true
            });

            expect(result.compose.services.web).toBeDefined();
            expect(result.compose.services['dev-tools']).toBeDefined();
            expect(result.compose.services['prod-cache']).toBeUndefined();
            expect(result.profiles).toEqual(['dev', 'prod']);
        });

        it('extracts all profiles', () => {
            const yaml = `
services:
  a:
    image: nginx
    profiles: [dev, test]
  b:
    image: postgres
    profiles: prod
`;

            const result = parseCompose(yaml);

            expect(result.profiles).toEqual(['dev', 'prod', 'test']);
        });

        it('handles extends', () => {
            const yaml = `
services:
  base:
    image: node:20
    environment:
      NODE_ENV: production
  app:
    extends: base
    ports:
      - "3000:3000"
`;

            const result = parseCompose(yaml, {
                enableExtends: true
            });

            expect(result.compose.services.app.image).toBe('node:20');
            expect(result.compose.services.app.ports).toEqual(['3000:3000']);
            expect(result.compose.services.app.extends).toBeUndefined();
        });

        it('handles includes with fileMap', () => {
            const main = `
include:
  - ./base.yml
services:
  app:
    image: app:latest
`;

            const fileMap = {
                'docker-compose.yml': main,
                'base.yml': 'services:\n  db:\n    image: postgres:15'
            };

            const result = parseCompose(main, {
                basePath: 'docker-compose.yml',
                fileMap,
                enableIncludes: true
            });

            expect(result.compose.services.app).toBeDefined();
            expect(result.compose.services.db).toBeDefined();
        });

        it('continues on non-fatal errors', () => {
            const yaml = `
services:
  web:
    extends: nonexistent
    image: nginx
`;

            const result = parseCompose(yaml, {
                enableExtends: true
            });

            // Should have error but still return compose
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.compose).toBeDefined();
        });

        it('returns error for invalid YAML', () => {
            const yaml = '{ invalid yaml: [';

            const result = parseCompose(yaml);

            expect(result.compose).toBe(null);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe('fatal');
        });

        it('can disable individual features', () => {
            const yaml = `
services:
  web:
    image: \${IMAGE}
    profiles: dev
`;

            const result = parseCompose(yaml, {
                environment: { IMAGE: 'nginx' },
                enableVariables: false,
                enableProfiles: false
            });

            // Variables not interpolated
            expect(result.compose.services.web.image).toBe('${IMAGE}');
        });
    });

    describe('parseYaml', () => {
        it('returns compose object directly', () => {
            const yaml = `
services:
  web:
    image: nginx
`;

            const compose = parseYaml(yaml);

            expect(compose.services.web).toBeDefined();
        });

        it('throws on fatal errors', () => {
            const yaml = '{ invalid';

            expect(() => parseYaml(yaml)).toThrow();
        });
    });

    describe('validateCompose', () => {
        it('validates services have image or build', () => {
            const compose = {
                services: {
                    valid: { image: 'nginx' },
                    invalid: { ports: ['80:80'] }
                }
            };

            const errors = validateCompose(compose);

            expect(errors.some(e => e.service === 'invalid')).toBe(true);
        });

        it('warns about empty services', () => {
            const compose = {
                services: {}
            };

            const errors = validateCompose(compose);

            expect(errors.some(e => e.type === 'warning')).toBe(true);
        });

        it('handles null compose', () => {
            const errors = validateCompose(null);

            expect(errors.length).toBeGreaterThan(0);
        });
    });
});
