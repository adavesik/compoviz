import { describe, it, expect } from 'vitest';
import { normalizeToAST } from './normalizeToAST.js';
import { exportToCompose } from './astExport.js';
import {
    getServicesByTier,
    getEffectiveImage,
    getEffectivePorts,
    getDependencies,
    getDependents,
    getServicesOnNetwork,
    getOrphanedVolumes,
    getPortConflicts,
    getTopologicalOrder,
    detectCycles,
    getBindMounts,
    getPrimaryNetwork,
} from './astQueries.js';
import { ServiceTiers } from './ComposeAST.js';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const FULL_COMPOSE = {
    name: 'myproject',
    services: {
        web: {
            image: 'nginx:1.25',
            ports: ['80:80', '443:443/tcp'],
            depends_on: {
                api: { condition: 'service_healthy' },
            },
            networks: ['frontend', 'backend'],
            volumes: ['./html:/usr/share/nginx/html:ro'],
            restart: 'unless-stopped',
            healthcheck: {
                test: ['CMD', 'curl', '-f', 'http://localhost'],
                interval: '30s',
                timeout: '10s',
                retries: 3,
            },
        },
        api: {
            build: {
                context: './api',
                dockerfile: 'Dockerfile.prod',
                target: 'production',
                args: { NODE_ENV: 'production' },
            },
            ports: ['3000:3000'],
            depends_on: ['db', 'redis'],
            networks: ['backend'],
            volumes: ['api-logs:/app/logs'],
            environment: { NODE_ENV: 'production', DB_HOST: 'db' },
            env_file: ['.env', '.env.production'],
            secrets: ['db_password'],
            deploy: {
                resources: {
                    limits: { cpus: '0.5', memory: '512M' },
                    reservations: { memory: '256M' },
                },
                replicas: 2,
            },
            labels: { 'com.example.tier': 'application' },
        },
        db: {
            image: 'postgres:16-alpine',
            ports: ['5432:5432'],
            networks: ['backend'],
            volumes: ['pgdata:/var/lib/postgresql/data'],
            environment: ['POSTGRES_DB=myapp', 'POSTGRES_USER=admin'],
            user: '1000:1000',
            healthcheck: {
                test: ['CMD-SHELL', 'pg_isready -U admin'],
                interval: '10s',
                retries: 5,
            },
        },
        redis: {
            image: 'redis:7-alpine',
            networks: ['backend'],
            volumes: ['redis-data:/data'],
        },
        worker: {
            image: 'myapp/worker:latest',
            depends_on: {
                db: { condition: 'service_healthy' },
                redis: { condition: 'service_started' },
            },
            networks: ['backend'],
            profiles: ['worker'],
        },
    },
    networks: {
        frontend: { driver: 'bridge' },
        backend: { driver: 'bridge', internal: true },
    },
    volumes: {
        pgdata: { driver: 'local' },
        'redis-data': {},
        'api-logs': {},
        'unused-vol': { driver: 'local' },
    },
    secrets: {
        db_password: { file: './secrets/db_password.txt' },
    },
    configs: {
        nginx_conf: { file: './nginx.conf' },
    },
};

// ─── Normalization Tests ────────────────────────────────────────────────────

describe('normalizeToAST', () => {
    it('handles null/undefined input', () => {
        const ast = normalizeToAST(null);
        expect(ast.services).toEqual([]);
        expect(ast.networks).toEqual([]);
        expect(ast.name).toBe('');
    });

    it('normalizes project name', () => {
        const ast = normalizeToAST(FULL_COMPOSE);
        expect(ast.name).toBe('myproject');
    });

    it('normalizes all services', () => {
        const ast = normalizeToAST(FULL_COMPOSE);
        expect(ast.services).toHaveLength(5);
        expect(ast.serviceMap.size).toBe(5);
    });

    describe('port parsing', () => {
        it('parses simple HOST:CONTAINER format', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const db = ast.serviceMap.get('db');
            expect(db.ports[0]).toMatchObject({
                hostIp: '0.0.0.0',
                hostPort: '5432',
                containerPort: '5432',
                protocol: 'tcp',
            });
        });

        it('parses port with protocol suffix', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const web = ast.serviceMap.get('web');
            expect(web.ports[1]).toMatchObject({
                hostPort: '443',
                containerPort: '443',
                protocol: 'tcp',
            });
        });

        it('parses IPv4 IP:HOST:CONTAINER format', () => {
            const compose = {
                services: { svc: { image: 'test', ports: ['127.0.0.1:8080:80'] } },
            };
            const ast = normalizeToAST(compose);
            expect(ast.services[0].ports[0]).toMatchObject({
                hostIp: '127.0.0.1',
                hostPort: '8080',
                containerPort: '80',
            });
        });

        it('parses IPv6 [::1]:HOST:CONTAINER format', () => {
            const compose = {
                services: { svc: { image: 'test', ports: ['[::1]:9090:80/udp'] } },
            };
            const ast = normalizeToAST(compose);
            expect(ast.services[0].ports[0]).toMatchObject({
                hostIp: '::1',
                hostPort: '9090',
                containerPort: '80',
                protocol: 'udp',
            });
        });

        it('parses object port format', () => {
            const compose = {
                services: {
                    svc: {
                        image: 'test',
                        ports: [{ published: 8080, target: 80, protocol: 'tcp', host_ip: '0.0.0.0' }],
                    },
                },
            };
            const ast = normalizeToAST(compose);
            expect(ast.services[0].ports[0]).toMatchObject({
                hostIp: '0.0.0.0',
                hostPort: 8080,
                containerPort: 80,
                protocol: 'tcp',
            });
        });
    });

    describe('dependency parsing', () => {
        it('normalizes array syntax depends_on', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const api = ast.serviceMap.get('api');
            expect(api.dependencies).toHaveLength(2);
            expect(api.dependencies[0]).toMatchObject({
                service: 'db',
                condition: 'service_started',
            });
        });

        it('normalizes object syntax depends_on with conditions', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const web = ast.serviceMap.get('web');
            expect(web.dependencies[0]).toMatchObject({
                service: 'api',
                condition: 'service_healthy',
            });
        });

        it('normalizes mixed conditions', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const worker = ast.serviceMap.get('worker');
            expect(worker.dependencies).toEqual([
                { service: 'db', condition: 'service_healthy', restart: false },
                { service: 'redis', condition: 'service_started', restart: false },
            ]);
        });
    });

    describe('network parsing', () => {
        it('normalizes array network attachments', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const web = ast.serviceMap.get('web');
            expect(web.networks).toHaveLength(2);
            expect(web.networks[0].network).toBe('frontend');
            expect(web.networks[1].network).toBe('backend');
        });

        it('normalizes object network attachments with config', () => {
            const compose = {
                services: {
                    svc: {
                        image: 'test',
                        networks: {
                            mynet: { aliases: ['alias1'], ipv4_address: '172.16.0.10' },
                        },
                    },
                },
                networks: { mynet: {} },
            };
            const ast = normalizeToAST(compose);
            expect(ast.services[0].networks[0]).toMatchObject({
                network: 'mynet',
                aliases: ['alias1'],
                ipv4Address: '172.16.0.10',
            });
        });
    });

    describe('volume parsing', () => {
        it('identifies named volumes', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const db = ast.serviceMap.get('db');
            expect(db.volumes[0]).toMatchObject({
                type: 'volume',
                source: 'pgdata',
                target: '/var/lib/postgresql/data',
                readOnly: false,
            });
        });

        it('identifies bind mounts', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const web = ast.serviceMap.get('web');
            expect(web.volumes[0]).toMatchObject({
                type: 'bind',
                source: './html',
                target: '/usr/share/nginx/html',
                readOnly: true,
            });
        });
    });

    describe('environment parsing', () => {
        it('normalizes object environment', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const api = ast.serviceMap.get('api');
            expect(api.environment).toEqual({
                NODE_ENV: 'production',
                DB_HOST: 'db',
            });
        });

        it('normalizes array environment', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const db = ast.serviceMap.get('db');
            expect(db.environment).toEqual({
                POSTGRES_DB: 'myapp',
                POSTGRES_USER: 'admin',
            });
        });
    });

    describe('classification', () => {
        it('classifies postgres as persistence tier', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const db = ast.serviceMap.get('db');
            expect(db.classification.tier).toBe(ServiceTiers.PERSISTENCE);
            expect(db.classification.role).toBe('database');
        });

        it('classifies redis as persistence tier', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const redis = ast.serviceMap.get('redis');
            expect(redis.classification.tier).toBe(ServiceTiers.PERSISTENCE);
            expect(redis.classification.role).toBe('cache');
        });

        it('classifies nginx as routing tier', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const web = ast.serviceMap.get('web');
            expect(web.classification.tier).toBe(ServiceTiers.ROUTING);
            expect(web.classification.role).toBe('proxy');
        });

        it('classifies generic services as application tier', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const api = ast.serviceMap.get('api');
            expect(api.classification.tier).toBe(ServiceTiers.APPLICATION);
        });
    });

    describe('healthcheck parsing', () => {
        it('parses healthcheck with all fields', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const web = ast.serviceMap.get('web');
            expect(web.healthcheck).toMatchObject({
                test: ['CMD', 'curl', '-f', 'http://localhost'],
                interval: '30s',
                timeout: '10s',
                retries: 3,
                disabled: false,
            });
        });

        it('returns null for missing healthcheck', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const redis = ast.serviceMap.get('redis');
            expect(redis.healthcheck).toBeNull();
        });
    });

    describe('deploy parsing', () => {
        it('parses resource limits and replicas', () => {
            const ast = normalizeToAST(FULL_COMPOSE);
            const api = ast.serviceMap.get('api');
            expect(api.deploy).toMatchObject({
                limits: { cpus: '0.5', memory: '512M' },
                reservations: { cpus: null, memory: '256M' },
                replicas: 2,
            });
        });
    });

    describe('metadata-wrapped values', () => {
        it('unwraps _value pattern', () => {
            const compose = {
                services: {
                    svc: {
                        image: { _value: 'nginx:1.25', _var: 'IMAGE' },
                        ports: [{ _value: '8080:80' }],
                    },
                },
            };
            const ast = normalizeToAST(compose);
            expect(ast.services[0].image).toBe('nginx:1.25');
            expect(ast.services[0].ports[0].hostPort).toBe('8080');
        });
    });

    describe('runtime metadata', () => {
        it('incorporates enrichment data', () => {
            const compose = {
                services: {
                    app: { build: './app' },
                },
            };
            const enrichment = {
                services: {
                    app: {
                        build: './app',
                        _resolvedImage: 'node:20-alpine',
                        _resolvedPorts: [{ port: 3000, protocol: 'tcp' }],
                    },
                },
            };
            const ast = normalizeToAST(compose, { enrichment });
            const app = ast.serviceMap.get('app');
            expect(app.runtime.resolvedImage).toBe('node:20-alpine');
            expect(app.runtime.resolvedPorts[0].containerPort).toBe('3000');
            expect(app.runtime.enriched).toBe(true);
        });
    });
});

// ─── Query Tests ────────────────────────────────────────────────────────────

describe('AST Queries', () => {
    const ast = normalizeToAST(FULL_COMPOSE);

    it('getServicesByTier filters correctly', () => {
        const persistence = getServicesByTier(ast, ServiceTiers.PERSISTENCE);
        expect(persistence.map(s => s.id).sort()).toEqual(['db', 'redis']);
    });

    it('getEffectiveImage returns explicit image', () => {
        const web = ast.serviceMap.get('web');
        expect(getEffectiveImage(web)).toBe('nginx:1.25');
    });

    it('getEffectiveImage falls back to resolved image', () => {
        const compose = { services: { app: { build: '.' } } };
        const enrichment = { services: { app: { build: '.', _resolvedImage: 'node:20' } } };
        const testAst = normalizeToAST(compose, { enrichment });
        expect(getEffectiveImage(testAst.services[0])).toBe('node:20');
    });

    it('getEffectivePorts falls back to resolved ports', () => {
        const compose = { services: { app: { build: '.' } } };
        const enrichment = {
            services: { app: { build: '.', _resolvedPorts: [{ port: 8080, protocol: 'tcp' }] } },
        };
        const testAst = normalizeToAST(compose, { enrichment });
        const ports = getEffectivePorts(testAst.services[0]);
        expect(ports[0].hostPort).toBe('8080');
    });

    it('getDependencies returns dependency services', () => {
        const deps = getDependencies(ast, 'web');
        expect(deps.map(d => d.id)).toEqual(['api']);
    });

    it('getDependents returns services that depend on target', () => {
        const dependents = getDependents(ast, 'db');
        expect(dependents.map(d => d.id).sort()).toEqual(['api', 'worker']);
    });

    it('getServicesOnNetwork returns correct services', () => {
        const backendServices = getServicesOnNetwork(ast, 'backend');
        expect(backendServices.map(s => s.id).sort()).toEqual(['api', 'db', 'redis', 'web', 'worker']);
    });

    it('getOrphanedVolumes finds unused volumes', () => {
        const orphaned = getOrphanedVolumes(ast);
        expect(orphaned.map(v => v.id)).toEqual(['unused-vol']);
    });

    it('getPortConflicts detects no conflicts in valid compose', () => {
        const conflicts = getPortConflicts(ast);
        expect(conflicts).toHaveLength(0);
    });

    it('getPortConflicts detects duplicate bindings', () => {
        const compose = {
            services: {
                a: { image: 'test', ports: ['8080:80'] },
                b: { image: 'test', ports: ['8080:3000'] },
            },
        };
        const testAst = normalizeToAST(compose);
        const conflicts = getPortConflicts(testAst);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].services.sort()).toEqual(['a', 'b']);
    });

    it('getTopologicalOrder returns valid startup order', () => {
        const order = getTopologicalOrder(ast);
        expect(order).not.toBeNull();
        // db and redis should come before api
        expect(order.indexOf('db')).toBeLessThan(order.indexOf('api'));
        expect(order.indexOf('redis')).toBeLessThan(order.indexOf('api'));
        // api should come before web
        expect(order.indexOf('api')).toBeLessThan(order.indexOf('web'));
    });

    it('detectCycles finds circular dependencies', () => {
        const compose = {
            services: {
                a: { image: 'test', depends_on: ['b'] },
                b: { image: 'test', depends_on: ['c'] },
                c: { image: 'test', depends_on: ['a'] },
            },
        };
        const testAst = normalizeToAST(compose);
        const cycles = detectCycles(testAst);
        expect(cycles.length).toBeGreaterThan(0);
    });

    it('getBindMounts collects all bind mount paths', () => {
        const mounts = getBindMounts(ast);
        expect(mounts).toHaveLength(1);
        expect(mounts[0].path).toBe('./html');
        expect(mounts[0].services).toEqual(['web']);
    });

    it('getPrimaryNetwork returns first network or default', () => {
        const web = ast.serviceMap.get('web');
        expect(getPrimaryNetwork(web)).toBe('frontend');

        const compose = { services: { svc: { image: 'test' } } };
        const testAst = normalizeToAST(compose);
        expect(getPrimaryNetwork(testAst.services[0])).toBe('_default');
    });
});

// ─── Round-trip Tests ───────────────────────────────────────────────────────

describe('AST Export (round-trip)', () => {
    it('exports back to valid compose structure', () => {
        const ast = normalizeToAST(FULL_COMPOSE);
        const exported = exportToCompose(ast, { useRaw: false });

        expect(exported.name).toBe('myproject');
        expect(Object.keys(exported.services)).toHaveLength(5);
        expect(exported.services.web.image).toBe('nginx:1.25');
        expect(exported.services.web.ports).toEqual(['80:80', '443:443/tcp']);
        expect(exported.services.db.environment).toEqual({
            POSTGRES_DB: 'myapp',
            POSTGRES_USER: 'admin',
        });
    });

    it('preserves depends_on format (simple array for started condition)', () => {
        const ast = normalizeToAST(FULL_COMPOSE);
        const exported = exportToCompose(ast, { useRaw: false });
        expect(exported.services.api.depends_on).toEqual(['db', 'redis']);
    });

    it('preserves depends_on format (object for non-default conditions)', () => {
        const ast = normalizeToAST(FULL_COMPOSE);
        const exported = exportToCompose(ast, { useRaw: false });
        expect(exported.services.web.depends_on).toEqual({
            api: { condition: 'service_healthy' },
        });
    });

    it('useRaw=true preserves original objects', () => {
        const ast = normalizeToAST(FULL_COMPOSE);
        const exported = exportToCompose(ast, { useRaw: true });
        // Should be the exact same reference
        expect(exported.services.web).toBe(FULL_COMPOSE.services.web);
    });
});
