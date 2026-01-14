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
    });
});
