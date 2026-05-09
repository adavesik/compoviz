import { describe, it, expect, beforeEach } from 'vitest';
import { enrichComposeState } from './dockerfileEnricher.js';
import { generateGraphviz } from './graphviz.js';
import { clearDockerfileCache } from './dockerfileFetcher.js';

/**
 * Integration tests for the Dockerfile enrichment pipeline.
 * Tests the full flow: compose state → enrichment → graphviz output.
 * Validates: Requirements 4.1, 4.4, 5.1
 */

describe('Dockerfile Enrichment Integration', () => {
    beforeEach(() => {
        clearDockerfileCache();
    });

    it('enriches services with build directives using fileMap Dockerfiles', async () => {
        const composeState = {
            services: {
                backend: {
                    build: './backend'
                },
                frontend: {
                    build: { context: './frontend', dockerfile: 'Dockerfile' }
                },
                db: {
                    image: 'postgres:15'
                }
            }
        };

        const fileMap = {
            'backend/Dockerfile': 'FROM node:18-alpine\nEXPOSE 3000\n',
            'frontend/Dockerfile': 'FROM nginx:latest\nEXPOSE 80\nEXPOSE 443\n'
        };

        const enriched = await enrichComposeState(composeState, {
            fileMap,
            exampleDir: null,
            timeout: 5000
        });

        // Backend should have resolved image and ports
        expect(enriched.services.backend._resolvedImage).toBe('node:18-alpine');
        expect(enriched.services.backend._resolvedPorts).toEqual([
            { port: 3000, protocol: 'tcp' }
        ]);

        // Frontend should have resolved image and ports
        expect(enriched.services.frontend._resolvedImage).toBe('nginx:latest');
        expect(enriched.services.frontend._resolvedPorts).toEqual([
            { port: 80, protocol: 'tcp' },
            { port: 443, protocol: 'tcp' }
        ]);

        // DB with explicit image should NOT be enriched
        expect(enriched.services.db._resolvedImage).toBeUndefined();
        expect(enriched.services.db._resolvedPorts).toBeUndefined();
    });

    it('enriched state produces DOT output with resolved image names', async () => {
        const composeState = {
            services: {
                api: {
                    build: './api'
                },
                worker: {
                    build: './worker'
                }
            }
        };

        const fileMap = {
            'api/Dockerfile': 'FROM python:3.11-slim\nEXPOSE 8000\n',
            'worker/Dockerfile': 'FROM golang:1.21\n'
        };

        const enriched = await enrichComposeState(composeState, {
            fileMap,
            exampleDir: null,
            timeout: 5000
        });

        const dot = generateGraphviz(enriched);

        // DOT output should contain resolved image names (without tags)
        expect(dot).toContain('<python>');
        expect(dot).toContain('<golang>');

        // Should contain port from EXPOSE
        expect(dot).toContain('label="8000"');
    });

    it('services with explicit image are not enriched even with matching Dockerfile', async () => {
        const composeState = {
            services: {
                app: {
                    build: './app',
                    image: 'myregistry/myapp:v2'
                }
            }
        };

        const fileMap = {
            'app/Dockerfile': 'FROM node:20\nEXPOSE 4000\n'
        };

        const enriched = await enrichComposeState(composeState, {
            fileMap,
            exampleDir: null,
            timeout: 5000
        });

        // Should NOT be enriched because explicit image exists
        expect(enriched.services.app._resolvedImage).toBeUndefined();
        expect(enriched.services.app.image).toBe('myregistry/myapp:v2');
    });

    it('services with explicit ports do not get _resolvedPorts', async () => {
        const composeState = {
            services: {
                web: {
                    build: './web',
                    ports: ['9000:9000']
                }
            }
        };

        const fileMap = {
            'web/Dockerfile': 'FROM node:18\nEXPOSE 3000\n'
        };

        const enriched = await enrichComposeState(composeState, {
            fileMap,
            exampleDir: null,
            timeout: 5000
        });

        // Should have _resolvedImage but NOT _resolvedPorts (explicit ports exist)
        expect(enriched.services.web._resolvedImage).toBe('node:18');
        expect(enriched.services.web._resolvedPorts).toBeUndefined();
    });

    it('enrichment with missing Dockerfile leaves service unchanged', async () => {
        const composeState = {
            services: {
                app: {
                    build: './app'
                }
            }
        };

        const fileMap = {};

        const enriched = await enrichComposeState(composeState, {
            fileMap,
            exampleDir: null,
            timeout: 5000
        });

        // No Dockerfile available — service should remain unchanged
        expect(enriched.services.app._resolvedImage).toBeUndefined();
        expect(enriched.services.app._resolvedPorts).toBeUndefined();
        expect(enriched.services.app.build).toBe('./app');
    });

    it('multi-stage Dockerfile with target resolves correct image', async () => {
        const composeState = {
            services: {
                app: {
                    build: {
                        context: './app',
                        target: 'production'
                    }
                }
            }
        };

        const fileMap = {
            'app/Dockerfile': [
                'FROM node:18 AS builder',
                'RUN npm ci',
                '',
                'FROM nginx:alpine AS production',
                'COPY --from=builder /app/dist /usr/share/nginx/html',
                'EXPOSE 80'
            ].join('\n')
        };

        const enriched = await enrichComposeState(composeState, {
            fileMap,
            exampleDir: null,
            timeout: 5000
        });

        // Should resolve to the target stage's FROM image
        expect(enriched.services.app._resolvedImage).toBe('nginx:alpine');
        expect(enriched.services.app._resolvedPorts).toEqual([
            { port: 80, protocol: 'tcp' }
        ]);
    });
});
