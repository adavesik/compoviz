import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCompose } from './composeParser.js';

// Helper to read fixture files
const DIRNAME = path.dirname(fileURLToPath(import.meta.url));
const readFixture = (filepath) => {
    return fs.readFileSync(path.resolve(DIRNAME, '../../fixtures/compose-specs', filepath), 'utf8');
};

describe('Parser Integration & Validation', () => {

    describe('Real-World Scenarios', () => {
        it('parses complex microservices architecture', () => {
            const yaml = readFixture('complex/microservices.yml');
            const result = parseCompose(yaml, {
                environment: {
                    DOMAIN: 'example.com',
                    DB_PASSWORD: 'secret_password',
                    JWT_SECRET: 'jwt_secret_key'
                },
                activeProfiles: ['dev'] // Should include monitoring services
            });

            const { services } = result.compose;
            const vars = result.variables;

            // 1. Validate Structure
            expect(Object.keys(services)).toContain('web');
            expect(Object.keys(services)).toContain('api');
            expect(Object.keys(services)).toContain('worker');
            expect(Object.keys(services)).toContain('prometheus'); // Profile: dev

            // 2. Validate Variable Interpolation
            expect(services.web.environment.NGINX_HOST).toBe('example.com');
            expect(services.api.environment.DATABASE_URL).toContain('postgres:secret_password@db');

            // 3. Validate Defaults
            expect(services.web.ports[0]).toBe('80:80'); // WEB_PORT default
            expect(services.db.image).toBe('postgres:15-alpine'); // POSTGRES_VERSION default

            // 4. Validate metadata extraction
            expect(Array.from(vars)).toContain('NGINX_VERSION');
            expect(Array.from(vars)).toContain('DB_PASSWORD');

            // 5. Validate Healthchecks (complex object)
            expect(services.api.healthcheck.interval).toBe('30s');
        });

        it('handles service inheritance correctly', () => {
            const yaml = readFixture('extends/multi-extends.yml');
            const result = parseCompose(yaml, { enableExtends: true });
            const { services } = result.compose;

            // 1. Verify 'frontend' extends 'base-web'
            expect(services.frontend.image).toBe('nginx:alpine'); // Inherited
            expect(services.frontend.restart).toBe('unless-stopped'); // Inherited
            expect(services.frontend.ports).toEqual(['80:80', '443:443']); // Own property

            // 2. Verify 'api-v1' extends 'base-api'
            expect(services['api-v1'].working_dir).toBe('/app'); // Inherited
            expect(services['api-v1'].command).toBe('npm run start:v1'); // Override

            // 3. Verify environment merging (deep merge logic check)
            // base-api has NODE_ENV: production
            // api-v1 has API_VERSION: v1
            expect(services['api-v1'].environment.NODE_ENV).toBe('production');
            expect(services['api-v1'].environment.API_VERSION).toBe('v1');
        });
    });

    describe('Validation Logic', () => {
        it('validates required variables', () => {
            const yaml = `
services:
  app:
    image: myapp
    environment:
      KEY: "\${REQUIRED_KEY:?error: key missing}"
`;
            // Valid case
            const validResult = parseCompose(yaml, {
                environment: { REQUIRED_KEY: 'value' }
            });
            expect(validResult.errors).toHaveLength(0);

            // Invalid case
            const invalidResult = parseCompose(yaml, {
                environment: {}
            });
            // Should contain a variable error
            // Should contain a variable error with specific message
            const variableError = invalidResult.errors.find(e => e.message.includes('key missing'));
            expect(variableError).toBeDefined();
            expect(variableError.type).toBe('variable');
        });

        it('validates profile Logic', () => {
            const yaml = readFixture('complex/microservices.yml');

            // Case 1: No profiles active
            const noProfileResult = parseCompose(yaml, { activeProfiles: [] });
            expect(noProfileResult.compose.services.prometheus).toBeUndefined(); // Has 'dev' profile

            // Case 2: Matching profile
            const matchingResult = parseCompose(yaml, { activeProfiles: ['monitoring'] });
            expect(matchingResult.compose.services.prometheus).toBeDefined();
        });
    });

    describe('Performance', () => {
        it('parses large file (50 services) efficiently', () => {
            const yaml = readFixture('performance/50-services.yml');

            const start = performance.now();
            const result = parseCompose(yaml, {
                environment: { GLOBAL: 'test-env' },
                enableVariables: true,
                enableExtends: true
            });
            const end = performance.now();
            const duration = end - start;

            // Verification
            expect(Object.keys(result.compose.services)).toHaveLength(50);
            expect(result.compose.services.service_50.environment.GLOBAL_VAR).toBe('test-env');

            // Performance Assertion (Soft limit, CI environments vary)
            // 50 services should be parsed well under 200ms on modern hardware
            // Logging it for visibility
            console.log(`Parsed 50 services in ${duration.toFixed(2)}ms`);
            expect(duration).toBeLessThan(1000); // Conservative limit for CI
        });
    });
});
