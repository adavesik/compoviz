import { describe, it, expect } from 'vitest';
import { generateGraphviz } from './graphviz';

describe('graphviz port parsing - comprehensive edge cases', () => {
    describe('protocol extraction', () => {
        it('defaults to tcp when no protocol specified', () => {
            const state = {
                services: {
                    web: { image: 'nginx', ports: ['80:80'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="tcp"');
        });

        it('extracts tcp protocol', () => {
            const state = {
                services: {
                    web: { image: 'nginx', ports: ['8080:80/tcp'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="tcp"');
        });

        it('extracts udp protocol', () => {
            const state = {
                services: {
                    dns: { image: 'coredns', ports: ['53:53/udp'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="udp"');
        });

        it('handles case-insensitive protocol', () => {
            const state = {
                services: {
                    dns: { image: 'coredns', ports: ['53:53/UDP'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="udp"');
        });

        it('extracts protocol with IPv4 bind address', () => {
            const state = {
                services: {
                    dns: { image: 'coredns', ports: ['127.0.0.1:53:53/udp'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="udp"');
            expect(dot).toContain('label="53"');
        });

        it('extracts protocol with IPv6 bind address', () => {
            const state = {
                services: {
                    dns: { image: 'coredns', ports: ['[::1]:53:53/udp'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="udp"');
            expect(dot).toContain('label="53"');
        });

        it('handles multiple ports with different protocols', () => {
            const state = {
                services: {
                    mixed: {
                        image: 'app',
                        ports: ['80:80/tcp', '53:53/udp', '443:443/tcp']
                    }
                }
            };
            const dot = generateGraphviz(state);
            // Should have both tcp and udp labels
            expect(dot).toContain('label="tcp"');
            expect(dot).toContain('label="udp"');
        });
    });

    describe('host port extraction', () => {
        it('extracts host port from simple format', () => {
            const state = {
                services: {
                    web: { image: 'nginx', ports: ['8080:80'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="8080"');
            expect(dot).not.toContain('label="80"'); // Should show host port, not container port
        });

        it('extracts host port from IPv4 bind address', () => {
            const state = {
                services: {
                    web: { image: 'nginx', ports: ['10.22.60.110:8080:80'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="8080"');
            expect(dot).not.toContain('label="10.22.60.110"'); // Should NOT show IP as port
        });

        it('extracts host port from IPv6 bind address', () => {
            const state = {
                services: {
                    web: { image: 'nginx', ports: ['[::1]:8080:80'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="8080"');
            expect(dot).not.toContain('label="[::1]"');
        });

        it('preserves port ranges', () => {
            const state = {
                services: {
                    web: { image: 'nginx', ports: ['8000-9000:80'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="8000-9000"');
        });

        it('handles port ranges with IPv4', () => {
            const state = {
                services: {
                    web: { image: 'nginx', ports: ['127.0.0.1:5000-5010:5000-5010'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="5000-5010"');
        });
    });

    describe('combined edge cases', () => {
        it('handles IPv4 + port range + protocol', () => {
            const state = {
                services: {
                    app: { image: 'app', ports: ['127.0.0.1:5000-5010:5000-5010/udp'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="5000-5010"');
            expect(dot).toContain('label="udp"');
        });

        it('handles IPv6 + protocol', () => {
            const state = {
                services: {
                    app: { image: 'app', ports: ['[2001:db8::1]:8080:80/tcp'] }
                }
            };
            const dot = generateGraphviz(state);
            expect(dot).toContain('label="8080"');
            expect(dot).toContain('label="tcp"');
        });

        it('handles all formats in one service', () => {
            const state = {
                services: {
                    complex: {
                        image: 'complex',
                        ports: [
                            '80:80',                           // Simple
                            '443:443/tcp',                     // With protocol
                            '127.0.0.1:8080:8080',            // IPv4 bind
                            '10.0.0.1:9000:9000/udp',         // IPv4 + protocol
                            '[::1]:3000:3000',                 // IPv6
                            '[::1]:4000:4000/tcp'              // IPv6 + protocol
                        ]
                    }
                }
            };
            const dot = generateGraphviz(state);
            // Verify all host ports are extracted correctly
            expect(dot).toContain('label="80"');
            expect(dot).toContain('label="443"');
            expect(dot).toContain('label="8080"');
            expect(dot).toContain('label="9000"');
            expect(dot).toContain('label="3000"');
            expect(dot).toContain('label="4000"');
            // Verify protocols
            expect(dot).toContain('label="tcp"');
            expect(dot).toContain('label="udp"');
            // Verify IP addresses are NOT shown as port labels
            expect(dot).not.toContain('label="127.0.0.1"');
            expect(dot).not.toContain('label="10.0.0.1"');
            expect(dot).not.toContain('label="[::1]"');
        });
    });
});
