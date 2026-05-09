import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateGraphviz } from './graphviz';

/**
 * Property-based tests for graphviz.js Dockerfile enrichment integration.
 * Validates: Requirements 5.1, 5.3, 5.4
 */

// --- Generators ---

/** Generate a valid Docker image name with optional tag */
const arbImageName = () => fc.oneof(
    fc.constantFrom('node', 'python', 'golang', 'ruby', 'php', 'java', 'rust'),
    fc.constantFrom('nginx', 'postgres', 'redis', 'mysql', 'mongo', 'traefik')
);

const arbImageWithTag = () => fc.tuple(arbImageName(), fc.constantFrom('latest', '18-alpine', '3.11-slim', '16', '8.1'))
    .map(([name, tag]) => `${name}:${tag}`);

/** Generate a service name (alphanumeric, lowercase) */
const arbServiceName = () => fc.stringMatching(/^[a-z][a-z0-9_]{1,12}$/).filter(s => s.length >= 2);

describe('Feature: dockerfile-metadata-enrichment, Property 6: Resolved Image Display in DOT Output', () => {
    it('services with _resolvedImage and no image show image name in DOT output', () => {
        fc.assert(
            fc.property(
                arbServiceName(),
                arbImageWithTag(),
                (serviceName, resolvedImage) => {
                    const state = {
                        services: {
                            [serviceName]: {
                                build: './app',
                                _resolvedImage: resolvedImage
                            }
                        }
                    };

                    const dot = generateGraphviz(state);
                    const imageName = resolvedImage.split(':')[0];

                    // The DOT output should contain the image name (without tag)
                    expect(dot).toContain(imageName);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Validates: Requirements 5.1, 5.4
     */
    it('services with _resolvedImage containing a tag display only the name portion', () => {
        fc.assert(
            fc.property(
                arbServiceName(),
                arbImageWithTag(),
                (serviceName, resolvedImage) => {
                    const state = {
                        services: {
                            [serviceName]: {
                                build: './app',
                                _resolvedImage: resolvedImage
                            }
                        }
                    };

                    const dot = generateGraphviz(state);
                    const imageName = resolvedImage.split(':')[0];

                    // Should contain the image name in the label format: <imageName>
                    expect(dot).toContain(`<${imageName}>`);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Feature: dockerfile-metadata-enrichment, Property 7: Tier Classification with Resolved Image', () => {
    it('services with _resolvedImage containing persistence keywords are placed in persistence tier', () => {
        const persistenceImages = ['postgres:15', 'mysql:8', 'redis:7-alpine', 'mongo:6', 'mariadb:10'];

        fc.assert(
            fc.property(
                arbServiceName(),
                fc.constantFrom(...persistenceImages),
                (serviceName, resolvedImage) => {
                    const state = {
                        services: {
                            [serviceName]: {
                                build: './db',
                                _resolvedImage: resolvedImage
                            }
                        }
                    };

                    const dot = generateGraphviz(state);

                    // Persistence tier services go into cluster_zone_persistence subgraph
                    expect(dot).toContain('cluster_zone_persistence');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('services with _resolvedImage containing routing keywords are placed in routing tier', () => {
        const routingImages = ['nginx:latest', 'traefik:v2.10', 'haproxy:2.8', 'caddy:2', 'envoy:latest'];

        fc.assert(
            fc.property(
                arbServiceName(),
                fc.constantFrom(...routingImages),
                (serviceName, resolvedImage) => {
                    const state = {
                        services: {
                            [serviceName]: {
                                build: './proxy',
                                _resolvedImage: resolvedImage
                            }
                        }
                    };

                    const dot = generateGraphviz(state);

                    // Routing tier services go into cluster_zone_gateway subgraph
                    expect(dot).toContain('cluster_zone_gateway');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('classifyServiceTier returns same tier for _resolvedImage as it would for explicit image', () => {
        const tierKeywords = [
            { image: 'postgres:15', tier: 'persistence' },
            { image: 'nginx:latest', tier: 'routing' },
            { image: 'redis:7', tier: 'persistence' },
            { image: 'traefik:v2', tier: 'routing' },
            { image: 'node:18', tier: 'application' }
        ];

        fc.assert(
            fc.property(
                arbServiceName(),
                fc.constantFrom(...tierKeywords),
                (serviceName, { image, tier }) => {
                    // Service with explicit image
                    const stateWithImage = {
                        services: {
                            [serviceName]: { image }
                        }
                    };

                    // Service with _resolvedImage (no explicit image)
                    const stateWithResolved = {
                        services: {
                            [serviceName]: { build: './app', _resolvedImage: image }
                        }
                    };

                    const dotWithImage = generateGraphviz(stateWithImage);
                    const dotWithResolved = generateGraphviz(stateWithResolved);

                    // Both should produce the same tier subgraph
                    if (tier === 'persistence') {
                        expect(dotWithImage).toContain('cluster_zone_persistence');
                        expect(dotWithResolved).toContain('cluster_zone_persistence');
                    } else if (tier === 'routing') {
                        expect(dotWithImage).toContain('cluster_zone_gateway');
                        expect(dotWithResolved).toContain('cluster_zone_gateway');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
