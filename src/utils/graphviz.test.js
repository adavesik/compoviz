import { describe, it, expect } from 'vitest';
import { escapeLabel, generateGraphviz } from './graphviz';

describe('graphviz utils', () => {
    describe('escapeLabel', () => {
        it('escapes backslashes for safe DOT labels', () => {
            expect(escapeLabel('C:\\path\\to\\svc')).toBe('C:\\\\path\\\\to\\\\svc');
        });
    });

    describe('generateGraphviz', () => {
        it('returns empty diagram when no services present', () => {
            const dot = generateGraphviz({});
            expect(dot).toContain('No services');
        });

        it('generates a node for each service', () => {
            const state = {
                services: {
                    frontend: { image: 'nginx' },
                    backend: { image: 'node' }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('frontend');
            expect(dot).toContain('backend');
        });

        it('generates ports in the entry zone', () => {
            const state = {
                services: {
                    web: { image: 'nginx', ports: ['80:80'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="80"');
            expect(dot).toContain('shape=circle');
            expect(dot).toContain('port_web_0');
        });

        it('groups services by network in clusters', () => {
            const state = {
                services: {
                    db: { image: 'postgres', networks: ['db_net'] }
                },
                networks: {
                    db_net: {}
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('subgraph cluster_net_db_net');
            expect(dot).toContain('label="🌐 db_net"');
        });

        it('represents depends_on as edges', () => {
            const state = {
                services: {
                    web: { image: 'nginx', depends_on: ['api'] },
                    api: { image: 'node' }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toMatch(/web\s*->\s*api/);
        });

        it('renders volumes in the storage zone', () => {
            const state = {
                services: {
                    db: { image: 'postgres', volumes: ['pg_data:/var/lib/postgresql/data'] }
                },
                volumes: {
                    pg_data: {}
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('vol_pg_data');
            expect(dot).toContain('label="💾 pg_data"');
            expect(dot).toMatch(/db\s*->\s*vol_pg_data/);
        });

        it('correctly extracts host port from bind address format', () => {
            const state = {
                services: {
                    web: {
                        image: 'nginx',
                        ports: [
                            '10.22.60.110:80:80',
                            '10.22.60.110:443:443',
                            '127.0.0.1:8080:8080/tcp'
                        ]
                    }
                }
            };
            const dot = generateGraphviz(state);
            // Should extract port numbers (80, 443, 8080), not IP addresses
            expect(dot).toContain('label="80"');
            expect(dot).toContain('label="443"');
            expect(dot).toContain('label="8080"');
            // Should NOT contain IP addresses as port labels
            expect(dot).not.toContain('label="10.22.60.110"');
            expect(dot).not.toContain('label="127.0.0.1"');
        });

        it('correctly handles IPv6 addresses with square brackets', () => {
            const state = {
                services: {
                    web: {
                        image: 'nginx',
                        ports: [
                            '[::1]:8080:80',
                            '[::1]:3000:3000/tcp',
                            '[2001:db8::1]:443:443'
                        ]
                    }
                }
            };
            const dot = generateGraphviz(state);
            // Should extract port numbers from IPv6 addresses
            expect(dot).toContain('label="8080"');
            expect(dot).toContain('label="3000"');
            expect(dot).toContain('label="443"');
            // Should NOT contain IPv6 addresses as labels
            expect(dot).not.toContain('label="[::1]"');
            expect(dot).not.toContain('label="::1"');
            expect(dot).not.toContain('label="2001:db8::1"');
        });

        it('correctly extracts protocol from port mappings', () => {
            const state = {
                services: {
                    dns: {
                        image: 'coredns',
                        ports: ['53:53/udp', '6060:6060/tcp']
                    }
                }
            };
            const dot = generateGraphviz(state);
            // Should show correct protocols
            expect(dot).toMatch(/label="udp"/);
            expect(dot).toMatch(/label="tcp"/);
        });

        it('handles parser metadata objects correctly', () => {
            const state = {
                services: {
                    web: {
                        image: { _value: 'nginx' },
                        ports: [{ _value: '80:80' }],
                        volumes: [{ _value: 'data:/data' }]
                    }
                },
                volumes: {
                    data: {}
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="80"');
            expect(dot).toContain('nginx');
            expect(dot).toContain('vol_data');
        });

        it('shows _resolvedImage in label when service has no explicit image', () => {
            const state = {
                services: {
                    backend: {
                        build: './backend',
                        _resolvedImage: 'node:18-alpine'
                    }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('<node>');
            expect(dot).toContain('backend');
        });

        it('shows "build" when service has neither image nor _resolvedImage', () => {
            const state = {
                services: {
                    myapp: {
                        build: './app'
                    }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('<build>');
        });

        it('shows only image name portion from _resolvedImage (strips tag)', () => {
            const state = {
                services: {
                    api: {
                        build: './api',
                        _resolvedImage: 'python:3.11-slim'
                    }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('<python>');
            // Should not contain the tag in the label
            expect(dot).not.toMatch(/<python:3\.11-slim>/);
        });

        it('uses _resolvedImage for tier classification when image is absent', () => {
            const state = {
                services: {
                    db: {
                        build: './db',
                        _resolvedImage: 'postgres:15'
                    }
                }
            };
            const dot = generateGraphviz(state);
            // Postgres should be classified as persistence tier
            expect(dot).toContain('cluster_zone_persistence');
        });

        it('uses _resolvedPorts as fallback when service has no explicit ports', () => {
            const state = {
                services: {
                    app: {
                        build: './app',
                        _resolvedImage: 'node:18',
                        _resolvedPorts: [
                            { port: 3000, protocol: 'tcp' },
                            { port: 8080, protocol: 'tcp' }
                        ]
                    }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="3000"');
            expect(dot).toContain('label="8080"');
            expect(dot).toContain('port_app_0');
            expect(dot).toContain('port_app_1');
        });
    });
});
