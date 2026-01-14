import { describe, it, expect } from 'vitest';
import { compareProjects, getComparisonSummary } from './comparison';

describe('compareProjects', () => {
    describe('port conflict detection', () => {
        it('should detect conflicts when same IP:port binding is used by multiple projects', () => {
            const projects = [
                {
                    id: 'proj1',
                    name: 'Project 1',
                    content: {
                        services: {
                            web: { ports: ['127.0.0.1:443:443'] }
                        }
                    }
                },
                {
                    id: 'proj2',
                    name: 'Project 2',
                    content: {
                        services: {
                            api: { ports: ['127.0.0.1:443:443'] }
                        }
                    }
                }
            ];

            const results = compareProjects(projects);
            const portConflicts = results.filter(r => r.category === 'port');

            expect(portConflicts).toHaveLength(1);
            expect(portConflicts[0].severity).toBe('error');
            expect(portConflicts[0].message).toContain('127.0.0.1:443');
        });

        it('should NOT detect conflicts when different IP bindings use same port number', () => {
            const projects = [
                {
                    id: 'proj1',
                    name: 'Project 1',
                    content: {
                        services: {
                            web: { ports: ['127.0.0.1:80:80'] }
                        }
                    }
                },
                {
                    id: 'proj2',
                    name: 'Project 2',
                    content: {
                        services: {
                            api: { ports: ['80:80'] } // Binds to 0.0.0.0:80
                        }
                    }
                }
            ];

            const results = compareProjects(projects);
            const portConflicts = results.filter(r => r.category === 'port');

            // Should have no conflicts because 127.0.0.1:80 and 0.0.0.0:80 are different bindings
            expect(portConflicts).toHaveLength(0);
        });

        it('should detect conflicts when multiple projects bind to all interfaces (0.0.0.0)', () => {
            const projects = [
                {
                    id: 'proj1',
                    name: 'Project 1',
                    content: {
                        services: {
                            web: { ports: ['443:443'] }
                        }
                    }
                },
                {
                    id: 'proj2',
                    name: 'Project 2',
                    content: {
                        services: {
                            api: { ports: ['443:443'] }
                        }
                    }
                }
            ];

            const results = compareProjects(projects);
            const portConflicts = results.filter(r => r.category === 'port');

            expect(portConflicts).toHaveLength(1);
            expect(portConflicts[0].message).toContain('0.0.0.0:443');
        });

        it('should handle port mappings with protocol suffix', () => {
            const projects = [
                {
                    id: 'proj1',
                    name: 'Project 1',
                    content: {
                        services: {
                            web: { ports: ['127.0.0.1:3000:3000/tcp'] }
                        }
                    }
                },
                {
                    id: 'proj2',
                    name: 'Project 2',
                    content: {
                        services: {
                            api: { ports: ['127.0.0.1:3000:3000/udp'] }
                        }
                    }
                }
            ];

            const results = compareProjects(projects);
            const portConflicts = results.filter(r => r.category === 'port');

            // Both bind to 127.0.0.1:3000, so it's a conflict
            expect(portConflicts).toHaveLength(1);
            expect(portConflicts[0].message).toContain('127.0.0.1:3000');
        });

        it('should handle different ports on same IP', () => {
            const projects = [
                {
                    id: 'proj1',
                    name: 'Project 1',
                    content: {
                        services: {
                            web: { ports: ['127.0.0.1:80:80'] }
                        }
                    }
                },
                {
                    id: 'proj2',
                    name: 'Project 2',
                    content: {
                        services: {
                            api: { ports: ['127.0.0.1:443:443'] }
                        }
                    }
                }
            ];

            const results = compareProjects(projects);
            const portConflicts = results.filter(r => r.category === 'port');

            // Different ports, no conflict
            expect(portConflicts).toHaveLength(0);
        });
    });

    describe('container name conflicts', () => {
        it('should detect container name conflicts', () => {
            const projects = [
                {
                    id: 'proj1',
                    name: 'Project 1',
                    content: {
                        services: {
                            web: { container_name: 'my-app' }
                        }
                    }
                },
                {
                    id: 'proj2',
                    name: 'Project 2',
                    content: {
                        services: {
                            api: { container_name: 'my-app' }
                        }
                    }
                }
            ];

            const results = compareProjects(projects);
            const conflicts = results.filter(r => r.category === 'container_name');

            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].severity).toBe('error');
        });
    });

    describe('volume sharing', () => {
        it('should flag host path volumes as warnings when shared', () => {
            const projects = [
                {
                    id: 'proj1',
                    name: 'Project 1',
                    content: {
                        services: {
                            web: { volumes: ['./data:/app/data'] }
                        }
                    }
                },
                {
                    id: 'proj2',
                    name: 'Project 2',
                    content: {
                        services: {
                            api: { volumes: ['./data:/api/data'] }
                        }
                    }
                }
            ];

            const results = compareProjects(projects);
            const volumeConflicts = results.filter(r => r.category === 'volume');

            expect(volumeConflicts).toHaveLength(1);
            expect(volumeConflicts[0].severity).toBe('warning');
        });

        it('should flag named volumes as info when shared', () => {
            const projects = [
                {
                    id: 'proj1',
                    name: 'Project 1',
                    content: {
                        services: {
                            web: { volumes: ['data:/app/data'] }
                        }
                    }
                },
                {
                    id: 'proj2',
                    name: 'Project 2',
                    content: {
                        services: {
                            api: { volumes: ['data:/api/data'] }
                        }
                    }
                }
            ];

            const results = compareProjects(projects);
            const volumeConflicts = results.filter(r => r.category === 'volume');

            expect(volumeConflicts).toHaveLength(1);
            expect(volumeConflicts[0].severity).toBe('info');
        });
    });

    describe('getComparisonSummary', () => {
        it('should correctly count results by severity', () => {
            const results = [
                { severity: 'error' },
                { severity: 'error' },
                { severity: 'warning' },
                { severity: 'info' },
                { severity: 'info' },
                { severity: 'info' }
            ];

            const summary = getComparisonSummary(results);

            expect(summary.errors).toBe(2);
            expect(summary.warnings).toBe(1);
            expect(summary.info).toBe(3);
        });
    });
});
