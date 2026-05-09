/**
 * Compose AST Normalizer
 * 
 * Transforms raw parsed Compose objects into the canonical ComposeAST model.
 * This is the single point where all polymorphic Compose shapes get resolved
 * into a consistent, pre-normalized structure.
 * 
 * After this transformation, no downstream consumer needs to handle:
 * - depends_on as array vs object
 * - ports as string vs object (with IPv4/IPv6/protocol variants)
 * - volumes as string vs object
 * - networks as array vs object
 * - environment as array vs object
 * - metadata-wrapped values (_value pattern)
 * 
 * Usage:
 *   import { normalizeToAST } from './normalizeToAST';
 *   const ast = normalizeToAST(parsedCompose, { enrichment: enrichedState });
 */

import { ServiceTiers, ServiceRoles, MountTypes, DependencyConditions, AST_VERSION } from './ComposeAST.js';
import { getServiceEmoji } from '../utils/iconUtils.jsx';

// ─── Value Unwrapping ───────────────────────────────────────────────────────

/**
 * Unwrap metadata-wrapped values (the _value pattern used for variable tracking).
 */
const unwrap = (val) => {
    if (val && typeof val === 'object' && '_value' in val) {
        return val._value;
    }
    return val;
};

// ─── Port Parsing ───────────────────────────────────────────────────────────

/**
 * Parse a single port mapping into a normalized PortBinding.
 * Handles all Docker Compose port formats:
 * - "8080:80"
 * - "127.0.0.1:8080:80"
 * - "[::1]:8080:80"
 * - "8080:80/udp"
 * - { published: 8080, target: 80, protocol: 'tcp' }
 * 
 * @param {string|Object} portRaw - Raw port value
 * @returns {PortBinding}
 */
function parsePort(portRaw) {
    const port = unwrap(portRaw);
    const raw = typeof port === 'string' ? port : JSON.stringify(port);

    if (typeof port === 'object' && port !== null) {
        return {
            hostIp: port.host_ip || '0.0.0.0',
            hostPort: port.published ?? port.target ?? '',
            containerPort: port.target ?? '',
            protocol: port.protocol || 'tcp',
            raw,
        };
    }

    // String parsing
    const portStr = String(port);
    let hostIp = '0.0.0.0';
    let hostPort = '';
    let containerPort = '';
    let protocol = 'tcp';

    // Extract protocol suffix
    const protoMatch = portStr.match(/\/(tcp|udp|sctp)$/i);
    if (protoMatch) {
        protocol = protoMatch[1].toLowerCase();
    }
    const withoutProto = portStr.replace(/\/(tcp|udp|sctp)$/i, '');

    // Handle IPv6 with brackets: [::1]:8080:80
    if (withoutProto.startsWith('[')) {
        const closeBracket = withoutProto.indexOf(']');
        if (closeBracket !== -1) {
            hostIp = withoutProto.substring(1, closeBracket); // Strip brackets
            const remaining = withoutProto.substring(closeBracket + 2); // Skip ]:
            const parts = remaining.split(':');
            if (parts.length === 2) {
                hostPort = parts[0];
                containerPort = parts[1];
            } else if (parts.length === 1) {
                hostPort = parts[0];
                containerPort = parts[0];
            }
        }
    } else {
        const parts = withoutProto.split(':');
        if (parts.length === 1) {
            // Just container port
            containerPort = parts[0];
            hostPort = parts[0];
        } else if (parts.length === 2) {
            // HOST:CONTAINER
            hostPort = parts[0];
            containerPort = parts[1];
        } else if (parts.length === 3) {
            // IP:HOST:CONTAINER
            hostIp = parts[0];
            hostPort = parts[1];
            containerPort = parts[2];
        }
    }

    return { hostIp, hostPort, containerPort, protocol, raw };
}

// ─── Dependency Parsing ─────────────────────────────────────────────────────

/**
 * Normalize depends_on into structured Dependency array.
 * @param {Array|Object|undefined} dependsOn - Raw depends_on value
 * @returns {Dependency[]}
 */
function parseDependencies(dependsOn) {
    if (!dependsOn) return [];

    if (Array.isArray(dependsOn)) {
        return dependsOn.map(name => ({
            service: String(unwrap(name)),
            condition: DependencyConditions.STARTED,
            restart: false,
        }));
    }

    if (typeof dependsOn === 'object') {
        return Object.entries(dependsOn).map(([name, config]) => ({
            service: name,
            condition: config?.condition || DependencyConditions.STARTED,
            restart: !!config?.restart, // Non-spec field, flagged by suggestions
        }));
    }

    return [];
}

// ─── Network Attachment Parsing ─────────────────────────────────────────────

/**
 * Normalize networks into structured NetworkAttachment array.
 * @param {Array|Object|undefined} networks - Raw networks value
 * @returns {NetworkAttachment[]}
 */
function parseNetworkAttachments(networks) {
    if (!networks) return [];

    if (Array.isArray(networks)) {
        return networks.map(n => ({
            network: String(unwrap(n)),
            aliases: [],
            ipv4Address: null,
            ipv6Address: null,
            priority: null,
        }));
    }

    if (typeof networks === 'object') {
        return Object.entries(networks).map(([name, config]) => ({
            network: name,
            aliases: config?.aliases || [],
            ipv4Address: config?.ipv4_address || null,
            ipv6Address: config?.ipv6_address || null,
            priority: config?.priority ?? null,
        }));
    }

    return [];
}

// ─── Volume/Mount Parsing ───────────────────────────────────────────────────

/**
 * Normalize a volume mount into a PersistenceMount.
 * @param {string|Object} volRaw - Raw volume value
 * @returns {PersistenceMount}
 */
function parseVolumeMount(volRaw) {
    const vol = unwrap(volRaw);
    const raw = typeof vol === 'string' ? vol : JSON.stringify(vol);

    if (typeof vol === 'object' && vol !== null) {
        return {
            type: vol.type || MountTypes.VOLUME,
            source: vol.source || '',
            target: vol.target || '',
            readOnly: vol.read_only || false,
            raw,
        };
    }

    // String format: source:target[:options]
    const parts = String(vol).split(':');
    const source = parts[0] || '';
    const target = parts[1] || '';
    const options = parts[2] || '';

    // Determine mount type from source
    let type = MountTypes.VOLUME;
    if (source.startsWith('.') || source.startsWith('/') || source.startsWith('~')) {
        type = MountTypes.BIND;
    }

    return {
        type,
        source,
        target,
        readOnly: options.includes('ro'),
        raw,
    };
}

// ─── Build Info Parsing ─────────────────────────────────────────────────────

/**
 * Normalize build configuration.
 * @param {string|Object|undefined} build - Raw build value
 * @returns {BuildInfo|null}
 */
function parseBuildInfo(build) {
    if (!build) return null;

    if (typeof build === 'string') {
        return {
            context: build,
            dockerfile: 'Dockerfile',
            target: null,
            args: {},
            cacheFrom: [],
        };
    }

    if (typeof build === 'object') {
        return {
            context: build.context || '.',
            dockerfile: build.dockerfile || 'Dockerfile',
            target: build.target || null,
            args: build.args || {},
            cacheFrom: build.cache_from || [],
        };
    }

    return null;
}

// ─── Healthcheck Parsing ────────────────────────────────────────────────────

/**
 * Normalize healthcheck configuration.
 * @param {Object|undefined} hc - Raw healthcheck value
 * @returns {Healthcheck|null}
 */
function parseHealthcheck(hc) {
    if (!hc) return null;
    if (hc.disable === true) {
        return { test: [], interval: null, timeout: null, retries: null, startPeriod: null, disabled: true };
    }

    let test = hc.test || [];
    if (typeof test === 'string') {
        test = ['CMD-SHELL', test];
    }

    return {
        test,
        interval: hc.interval || null,
        timeout: hc.timeout || null,
        retries: hc.retries ?? null,
        startPeriod: hc.start_period || null,
        disabled: false,
    };
}

// ─── Deploy Parsing ─────────────────────────────────────────────────────────

/**
 * Normalize deploy configuration.
 * @param {Object|undefined} deploy - Raw deploy value
 * @returns {DeployConfig|null}
 */
function parseDeployConfig(deploy) {
    if (!deploy) return null;

    const resources = deploy.resources || {};
    return {
        limits: {
            cpus: resources.limits?.cpus || null,
            memory: resources.limits?.memory || null,
        },
        reservations: {
            cpus: resources.reservations?.cpus || null,
            memory: resources.reservations?.memory || null,
        },
        replicas: deploy.replicas ?? null,
        restartPolicy: deploy.restart_policy?.condition || null,
    };
}

// ─── Environment Parsing ────────────────────────────────────────────────────

/**
 * Normalize environment into a flat key-value object.
 * @param {Array|Object|undefined} env - Raw environment value
 * @returns {Object<string, string>}
 */
function parseEnvironment(env) {
    if (!env) return {};

    if (Array.isArray(env)) {
        const result = {};
        for (const entry of env) {
            const str = String(unwrap(entry));
            const eqIdx = str.indexOf('=');
            if (eqIdx === -1) {
                result[str] = '';
            } else {
                result[str.substring(0, eqIdx)] = str.substring(eqIdx + 1);
            }
        }
        return result;
    }

    if (typeof env === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(env)) {
            result[k] = v != null ? String(unwrap(v)) : '';
        }
        return result;
    }

    return {};
}

// ─── Service Classification ─────────────────────────────────────────────────

/** Pattern sets for classification */
const CLASSIFICATION_PATTERNS = {
    database: ['postgres', 'mysql', 'mariadb', 'mongo', 'cockroach', 'timescale', 'cassandra', 'influx', 'neo4j', 'couchdb', 'rethinkdb'],
    cache: ['redis', 'memcached', 'varnish', 'hazelcast'],
    queue: ['rabbitmq', 'kafka', 'nats', 'activemq', 'zeromq', 'pulsar'],
    proxy: ['traefik', 'nginx', 'haproxy', 'caddy', 'envoy', 'kong', 'gateway', 'ambassador'],
    monitoring: ['prometheus', 'grafana', 'jaeger', 'zipkin', 'datadog', 'newrelic', 'elastic', 'kibana', 'logstash', 'fluentd'],
    storage: ['minio', 'ceph', 'gluster', 'nfs'],
};

/**
 * Classify a service based on its image and name.
 * @param {string} name - Service name
 * @param {string|null} image - Image reference
 * @param {PortBinding[]} ports - Parsed ports
 * @returns {ServiceClassification}
 */
function classifyService(name, image, ports) {
    const imageStr = (image || '').toLowerCase();
    const nameStr = name.toLowerCase();
    const searchStr = `${imageStr} ${nameStr}`;

    // Check each role pattern
    for (const [role, patterns] of Object.entries(CLASSIFICATION_PATTERNS)) {
        if (patterns.some(p => searchStr.includes(p))) {
            let tier;
            if (role === 'database' || role === 'cache' || role === 'storage') {
                tier = ServiceTiers.PERSISTENCE;
            } else if (role === 'proxy') {
                tier = ServiceTiers.ROUTING;
            } else if (role === 'queue') {
                tier = ServiceTiers.PERSISTENCE;
            } else if (role === 'monitoring') {
                tier = ServiceTiers.APPLICATION;
            } else {
                tier = ServiceTiers.APPLICATION;
            }

            return {
                tier,
                role,
                icon: getServiceEmoji(name, image),
            };
        }
    }

    // Check if it's a routing service based on common web ports
    const webPorts = ['80', '443', '8080', '8443', '4443'];
    const hasWebPorts = ports.some(p =>
        webPorts.includes(String(p.hostPort)) || webPorts.includes(String(p.containerPort))
    );

    if (hasWebPorts) {
        return {
            tier: ServiceTiers.ROUTING,
            role: ServiceRoles.WEBSERVER,
            icon: getServiceEmoji(name, image),
        };
    }

    // Default: application tier
    return {
        tier: ServiceTiers.APPLICATION,
        role: ServiceRoles.APPLICATION,
        icon: getServiceEmoji(name, image),
    };
}

// ─── Secret/Config Reference Parsing ────────────────────────────────────────

/**
 * Extract secret names from service secrets field.
 * @param {Array|undefined} secrets - Raw secrets value
 * @returns {string[]}
 */
function parseSecretRefs(secrets) {
    if (!secrets || !Array.isArray(secrets)) return [];
    return secrets.map(s => {
        const val = unwrap(s);
        return typeof val === 'string' ? val : val?.source || '';
    }).filter(Boolean);
}

/**
 * Extract config names from service configs field.
 * @param {Array|undefined} configs - Raw configs value
 * @returns {string[]}
 */
function parseConfigRefs(configs) {
    if (!configs || !Array.isArray(configs)) return [];
    return configs.map(c => {
        const val = unwrap(c);
        return typeof val === 'string' ? val : val?.source || '';
    }).filter(Boolean);
}

// ─── Env File Parsing ───────────────────────────────────────────────────────

/**
 * Normalize env_file into array of paths.
 * @param {string|Array|undefined} envFile - Raw env_file value
 * @returns {string[]}
 */
function parseEnvFiles(envFile) {
    if (!envFile) return [];
    if (typeof envFile === 'string') return [envFile];
    if (Array.isArray(envFile)) {
        return envFile.map(e => {
            const val = unwrap(e);
            return typeof val === 'string' ? val : val?.path || '';
        }).filter(Boolean);
    }
    return [];
}

// ─── Main Normalizer ────────────────────────────────────────────────────────

/**
 * Transform a raw parsed Compose object into the canonical ComposeAST.
 * 
 * @param {Object} compose - Raw compose object from parseCompose()
 * @param {Object} [options={}] - Normalization options
 * @param {Object} [options.enrichment] - Enriched state with _resolvedImage/_resolvedPorts
 * @returns {ComposeAST}
 */
export function normalizeToAST(compose, options = {}) {
    if (!compose || typeof compose !== 'object') {
        return createEmptyAST();
    }

    const enrichment = options.enrichment || compose;
    const rawServices = compose.services || {};
    const rawNetworks = compose.networks || {};
    const rawVolumes = compose.volumes || {};
    const rawSecrets = compose.secrets || {};
    const rawConfigs = compose.configs || {};

    // ── Normalize Services ──
    const services = Object.entries(rawServices).map(([name, svc]) => {
        if (!svc || typeof svc !== 'object') {
            return createEmptyServiceNode(name);
        }

        const image = unwrap(svc.image) || null;
        const ports = normalizeArrayField(svc.ports).map(parsePort);
        const enrichedSvc = enrichment.services?.[name] || svc;

        // Runtime metadata from Dockerfile enrichment
        const runtime = {
            resolvedImage: enrichedSvc._resolvedImage || null,
            resolvedPorts: (enrichedSvc._resolvedPorts || []).map(rp => ({
                hostIp: '0.0.0.0',
                hostPort: String(rp.port),
                containerPort: String(rp.port),
                protocol: rp.protocol || 'tcp',
                raw: `${rp.port}/${rp.protocol || 'tcp'}`,
            })),
            enriched: !!enrichedSvc._resolvedImage || !!enrichedSvc._resolvedPorts,
        };

        const effectiveImage = image || runtime.resolvedImage;
        const classification = classifyService(name, effectiveImage, ports);

        return {
            id: name,
            image,
            build: parseBuildInfo(svc.build),
            containerName: svc.container_name || null,
            ports,
            dependencies: parseDependencies(svc.depends_on),
            networks: parseNetworkAttachments(svc.networks),
            volumes: normalizeArrayField(svc.volumes).map(parseVolumeMount),
            secrets: parseSecretRefs(svc.secrets),
            configs: parseConfigRefs(svc.configs),
            environment: parseEnvironment(svc.environment),
            envFiles: parseEnvFiles(svc.env_file),
            profiles: normalizeArrayField(svc.profiles).map(p => String(unwrap(p))),
            healthcheck: parseHealthcheck(svc.healthcheck),
            deploy: parseDeployConfig(svc.deploy),
            restart: svc.restart || null,
            user: svc.user || null,
            privileged: svc.privileged === true,
            labels: parseLabels(svc.labels),
            classification,
            runtime,
            _raw: svc,
        };
    });

    // ── Normalize Networks ──
    const networks = Object.entries(rawNetworks).map(([name, net]) => {
        const config = (net && typeof net === 'object') ? net : {};
        return {
            id: name,
            driver: config.driver || 'bridge',
            external: config.external === true || (typeof config.external === 'object'),
            internal: config.internal === true,
            attachable: config.attachable === true,
            labels: parseLabels(config.labels),
            _raw: net,
        };
    });

    // ── Normalize Volumes ──
    const volumes = Object.entries(rawVolumes).map(([name, vol]) => {
        const config = (vol && typeof vol === 'object') ? vol : {};
        return {
            id: name,
            driver: config.driver || 'local',
            driverOpts: config.driver_opts || {},
            external: config.external === true || (typeof config.external === 'object'),
            labels: parseLabels(config.labels),
            _raw: vol,
        };
    });

    // ── Normalize Secrets ──
    const secrets = Object.entries(rawSecrets).map(([name, sec]) => {
        const config = (sec && typeof sec === 'object') ? sec : {};
        return {
            id: name,
            file: config.file || null,
            external: config.external === true || (typeof config.external === 'object'),
            _raw: sec,
        };
    });

    // ── Normalize Configs ──
    const configs = Object.entries(rawConfigs).map(([name, cfg]) => {
        const config = (cfg && typeof cfg === 'object') ? cfg : {};
        return {
            id: name,
            file: config.file || null,
            external: config.external === true || (typeof config.external === 'object'),
            _raw: cfg,
        };
    });

    // ── Build lookup maps ──
    const serviceMap = new Map(services.map(s => [s.id, s]));
    const networkMap = new Map(networks.map(n => [n.id, n]));
    const volumeMap = new Map(volumes.map(v => [v.id, v]));

    return {
        _version: AST_VERSION,
        name: compose.name || '',
        services,
        networks,
        volumes,
        secrets,
        configs,
        serviceMap,
        networkMap,
        volumeMap,
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalize a field that could be array, object, or undefined into an array.
 */
function normalizeArrayField(val) {
    const v = unwrap(val);
    if (!v) return [];
    if (Array.isArray(v)) return v;
    return [];
}

/**
 * Normalize labels (can be array of "key=value" or object).
 */
function parseLabels(labels) {
    if (!labels) return {};
    if (Array.isArray(labels)) {
        const result = {};
        for (const entry of labels) {
            const str = String(unwrap(entry));
            const eqIdx = str.indexOf('=');
            if (eqIdx === -1) result[str] = '';
            else result[str.substring(0, eqIdx)] = str.substring(eqIdx + 1);
        }
        return result;
    }
    if (typeof labels === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(labels)) {
            result[k] = v != null ? String(unwrap(v)) : '';
        }
        return result;
    }
    return {};
}

/**
 * Create an empty AST (for null/invalid input).
 */
function createEmptyAST() {
    return {
        _version: AST_VERSION,
        name: '',
        services: [],
        networks: [],
        volumes: [],
        secrets: [],
        configs: [],
        serviceMap: new Map(),
        networkMap: new Map(),
        volumeMap: new Map(),
    };
}

/**
 * Create a minimal service node for invalid service entries.
 */
function createEmptyServiceNode(name) {
    return {
        id: name,
        image: null,
        build: null,
        containerName: null,
        ports: [],
        dependencies: [],
        networks: [],
        volumes: [],
        secrets: [],
        configs: [],
        environment: {},
        envFiles: [],
        profiles: [],
        healthcheck: null,
        deploy: null,
        restart: null,
        user: null,
        privileged: false,
        labels: {},
        classification: { tier: ServiceTiers.APPLICATION, role: ServiceRoles.APPLICATION, icon: '📦' },
        runtime: { resolvedImage: null, resolvedPorts: [], enriched: false },
        _raw: {},
    };
}
