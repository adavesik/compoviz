/**
 * AST Export Layer
 * 
 * Converts the canonical ComposeAST back to a raw Compose object
 * suitable for YAML serialization. This enables round-tripping:
 * 
 *   YAML → parse → normalize → AST → export → YAML
 * 
 * The export layer can also target different output formats in the future:
 * - Docker Compose (default)
 * - Kubernetes manifests
 * - Docker Swarm stack
 * - Podman Compose
 * - ECS task definitions
 */

import { MountTypes, DependencyConditions } from './ComposeAST.js';

/**
 * Export ComposeAST back to a raw Compose object (for YAML serialization).
 * 
 * Strategy: Use _raw fields when available for maximum fidelity,
 * fall back to reconstructing from normalized fields.
 * 
 * @param {ComposeAST} ast - The canonical AST
 * @param {Object} [options={}] - Export options
 * @param {boolean} [options.useRaw=true] - Prefer _raw fields for fidelity
 * @param {boolean} [options.minimal=false] - Omit empty/default fields
 * @returns {Object} Raw compose object ready for YAML serialization
 */
export function exportToCompose(ast, options = {}) {
    const { useRaw = true, minimal = false } = options;

    const compose = {};

    if (ast.name) {
        compose.name = ast.name;
    }

    // Services
    if (ast.services.length > 0) {
        compose.services = {};
        for (const service of ast.services) {
            compose.services[service.id] = useRaw && service._raw
                ? service._raw
                : exportService(service, minimal);
        }
    }

    // Networks
    if (ast.networks.length > 0) {
        compose.networks = {};
        for (const network of ast.networks) {
            compose.networks[network.id] = useRaw && network._raw
                ? network._raw
                : exportNetwork(network, minimal);
        }
    }

    // Volumes
    if (ast.volumes.length > 0) {
        compose.volumes = {};
        for (const volume of ast.volumes) {
            compose.volumes[volume.id] = useRaw && volume._raw
                ? volume._raw
                : exportVolume(volume, minimal);
        }
    }

    // Secrets
    if (ast.secrets.length > 0) {
        compose.secrets = {};
        for (const secret of ast.secrets) {
            compose.secrets[secret.id] = useRaw && secret._raw
                ? secret._raw
                : exportSecret(secret, minimal);
        }
    }

    // Configs
    if (ast.configs.length > 0) {
        compose.configs = {};
        for (const config of ast.configs) {
            compose.configs[config.id] = useRaw && config._raw
                ? config._raw
                : exportConfig(config, minimal);
        }
    }

    return compose;
}

/**
 * Export a ServiceNode to raw Compose service format.
 */
function exportService(service, minimal) {
    const svc = {};

    if (service.image) svc.image = service.image;
    if (service.build) svc.build = exportBuild(service.build, minimal);
    if (service.containerName) svc.container_name = service.containerName;

    // Ports - use raw strings for readability
    if (service.ports.length > 0) {
        svc.ports = service.ports.map(p => p.raw);
    }

    // Dependencies
    if (service.dependencies.length > 0) {
        const allSimple = service.dependencies.every(
            d => d.condition === DependencyConditions.STARTED && !d.restart
        );
        if (allSimple) {
            svc.depends_on = service.dependencies.map(d => d.service);
        } else {
            svc.depends_on = {};
            for (const dep of service.dependencies) {
                svc.depends_on[dep.service] = { condition: dep.condition };
            }
        }
    }

    // Networks
    if (service.networks.length > 0) {
        const allSimple = service.networks.every(
            n => n.aliases.length === 0 && !n.ipv4Address && !n.ipv6Address
        );
        if (allSimple) {
            svc.networks = service.networks.map(n => n.network);
        } else {
            svc.networks = {};
            for (const net of service.networks) {
                const config = {};
                if (net.aliases.length > 0) config.aliases = net.aliases;
                if (net.ipv4Address) config.ipv4_address = net.ipv4Address;
                if (net.ipv6Address) config.ipv6_address = net.ipv6Address;
                svc.networks[net.network] = Object.keys(config).length > 0 ? config : null;
            }
        }
    }

    // Volumes - use raw strings
    if (service.volumes.length > 0) {
        svc.volumes = service.volumes.map(v => v.raw);
    }

    // Environment
    if (Object.keys(service.environment).length > 0) {
        svc.environment = { ...service.environment };
    }

    // Env files
    if (service.envFiles.length > 0) {
        svc.env_file = service.envFiles.length === 1 ? service.envFiles[0] : service.envFiles;
    }

    // Secrets
    if (service.secrets.length > 0) svc.secrets = [...service.secrets];

    // Configs
    if (service.configs.length > 0) svc.configs = [...service.configs];

    // Profiles
    if (service.profiles.length > 0) svc.profiles = [...service.profiles];

    // Healthcheck
    if (service.healthcheck) {
        if (service.healthcheck.disabled) {
            svc.healthcheck = { disable: true };
        } else {
            svc.healthcheck = { test: service.healthcheck.test };
            if (service.healthcheck.interval) svc.healthcheck.interval = service.healthcheck.interval;
            if (service.healthcheck.timeout) svc.healthcheck.timeout = service.healthcheck.timeout;
            if (service.healthcheck.retries != null) svc.healthcheck.retries = service.healthcheck.retries;
            if (service.healthcheck.startPeriod) svc.healthcheck.start_period = service.healthcheck.startPeriod;
        }
    }

    // Deploy
    if (service.deploy && !minimal) {
        svc.deploy = exportDeploy(service.deploy);
    }

    // Simple fields
    if (service.restart) svc.restart = service.restart;
    if (service.user) svc.user = service.user;
    if (service.privileged) svc.privileged = true;
    if (Object.keys(service.labels).length > 0) svc.labels = { ...service.labels };

    return svc;
}

/**
 * Export BuildInfo to raw Compose build format.
 */
function exportBuild(build, minimal) {
    if (minimal && build.dockerfile === 'Dockerfile' && !build.target && Object.keys(build.args).length === 0) {
        return build.context;
    }

    const result = { context: build.context };
    if (build.dockerfile !== 'Dockerfile') result.dockerfile = build.dockerfile;
    if (build.target) result.target = build.target;
    if (Object.keys(build.args).length > 0) result.args = { ...build.args };
    if (build.cacheFrom.length > 0) result.cache_from = [...build.cacheFrom];
    return result;
}

/**
 * Export DeployConfig to raw Compose deploy format.
 */
function exportDeploy(deploy) {
    const result = {};
    if (deploy.replicas != null) result.replicas = deploy.replicas;
    if (deploy.restartPolicy) {
        result.restart_policy = { condition: deploy.restartPolicy };
    }

    const hasLimits = deploy.limits.cpus || deploy.limits.memory;
    const hasReservations = deploy.reservations.cpus || deploy.reservations.memory;
    if (hasLimits || hasReservations) {
        result.resources = {};
        if (hasLimits) {
            result.resources.limits = {};
            if (deploy.limits.cpus) result.resources.limits.cpus = deploy.limits.cpus;
            if (deploy.limits.memory) result.resources.limits.memory = deploy.limits.memory;
        }
        if (hasReservations) {
            result.resources.reservations = {};
            if (deploy.reservations.cpus) result.resources.reservations.cpus = deploy.reservations.cpus;
            if (deploy.reservations.memory) result.resources.reservations.memory = deploy.reservations.memory;
        }
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Export NetworkNode to raw Compose network format.
 */
function exportNetwork(network, minimal) {
    if (minimal && network.driver === 'bridge' && !network.external && !network.internal) {
        return {};
    }
    const result = {};
    if (network.driver !== 'bridge') result.driver = network.driver;
    if (network.external) result.external = true;
    if (network.internal) result.internal = true;
    if (network.attachable) result.attachable = true;
    if (Object.keys(network.labels).length > 0) result.labels = { ...network.labels };
    return result;
}

/**
 * Export VolumeNode to raw Compose volume format.
 */
function exportVolume(volume, minimal) {
    if (minimal && volume.driver === 'local' && !volume.external && Object.keys(volume.driverOpts).length === 0) {
        return {};
    }
    const result = {};
    if (volume.driver !== 'local') result.driver = volume.driver;
    if (Object.keys(volume.driverOpts).length > 0) result.driver_opts = { ...volume.driverOpts };
    if (volume.external) result.external = true;
    if (Object.keys(volume.labels).length > 0) result.labels = { ...volume.labels };
    return result;
}

/**
 * Export SecretNode to raw Compose secret format.
 */
function exportSecret(secret) {
    const result = {};
    if (secret.file) result.file = secret.file;
    if (secret.external) result.external = true;
    return result;
}

/**
 * Export ConfigNode to raw Compose config format.
 */
function exportConfig(config) {
    const result = {};
    if (config.file) result.file = config.file;
    if (config.external) result.external = true;
    return result;
}
