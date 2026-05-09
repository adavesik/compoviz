/**
 * Canonical Compose AST (Abstract Syntax Tree)
 * 
 * This module defines the normalized internal representation of a Compose project.
 * All consumers (graphviz, flow builder, validation, suggestions, export) read from
 * this canonical model instead of re-interpreting raw Compose shapes.
 * 
 * Pipeline:
 *   Raw YAML → parseCompose() → raw compose object
 *                                      ↓
 *                              normalizeToAST()
 *                                      ↓
 *                              ComposeAST (this model)
 *                                      ↓
 *                    ┌─────────────────┼─────────────────┐
 *                    ↓                 ↓                 ↓
 *              Visualization      Validation        Export
 *              (graphviz/flow)    (suggestions)     (YAML/K8s/etc)
 * 
 * Design principles:
 * - Pre-normalized: no polymorphic shapes (depends_on is always structured, ports always parsed)
 * - Computed properties: classification, tier, etc. are derived once
 * - Immutable after creation: consumers never mutate the AST
 * - Lossless: retains enough info to round-trip back to valid Compose YAML
 * - Extensible: future targets (K8s, ECS, Swarm) add fields without breaking existing consumers
 */

// ─── AST Version ────────────────────────────────────────────────────────────

/**
 * Schema version for the ComposeAST structure.
 * Bump this when making breaking changes to the AST shape.
 * Enables migration logic for persisted snapshots, plugins, and cached analyses.
 */
export const AST_VERSION = 1;

// ─── Service Classification ─────────────────────────────────────────────────

/**
 * @typedef {'ingress' | 'routing' | 'application' | 'persistence'} ServiceTier
 */

/**
 * @typedef {'database' | 'cache' | 'queue' | 'proxy' | 'webserver' | 'application' | 'monitoring' | 'storage'} ServiceRole
 */

/**
 * @typedef {Object} ServiceClassification
 * @property {ServiceTier} tier - Functional tier in the architecture
 * @property {ServiceRole} role - Specific role within the tier
 * @property {string} icon - Emoji/icon identifier for visualization
 */

// ─── Port Bindings ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} PortBinding
 * @property {string} hostIp - Host IP to bind (default '0.0.0.0')
 * @property {string|number} hostPort - Published port on host
 * @property {string|number} containerPort - Target port in container
 * @property {string} protocol - 'tcp' | 'udp' | 'sctp'
 * @property {string} raw - Original raw value for round-tripping
 */

// ─── Dependencies ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} Dependency
 * @property {string} service - Target service name
 * @property {'service_started' | 'service_healthy' | 'service_completed_successfully'} condition
 * @property {boolean} restart - Whether to restart on dependency failure (non-spec, flagged)
 */

// ─── Network Attachments ────────────────────────────────────────────────────

/**
 * @typedef {Object} NetworkAttachment
 * @property {string} network - Network name
 * @property {string[]} aliases - Container aliases on this network
 * @property {string|null} ipv4Address - Static IPv4 address
 * @property {string|null} ipv6Address - Static IPv6 address
 * @property {number|null} priority - Network priority
 */

// ─── Volume/Persistence ─────────────────────────────────────────────────────

/**
 * @typedef {'volume' | 'bind' | 'tmpfs' | 'npipe' | 'cluster'} MountType
 */

/**
 * @typedef {Object} PersistenceMount
 * @property {MountType} type - Mount type
 * @property {string} source - Volume name or host path
 * @property {string} target - Container mount path
 * @property {boolean} readOnly - Whether mount is read-only
 * @property {string} raw - Original raw value for round-tripping
 */

// ─── Build Info ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BuildInfo
 * @property {string} context - Build context path
 * @property {string} dockerfile - Dockerfile path (relative to context)
 * @property {string|null} target - Multi-stage build target
 * @property {Object<string, string>} args - Build arguments
 * @property {string[]} cacheFrom - Cache sources
 */

// ─── Healthcheck ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Healthcheck
 * @property {string[]} test - Test command
 * @property {string|null} interval - Check interval
 * @property {string|null} timeout - Check timeout
 * @property {number|null} retries - Number of retries
 * @property {string|null} startPeriod - Start period grace
 * @property {boolean} disabled - Whether healthcheck is disabled
 */

// ─── Deploy / Resources ─────────────────────────────────────────────────────

/**
 * @typedef {Object} ResourceSpec
 * @property {string|null} cpus - CPU limit (e.g., '0.5')
 * @property {string|null} memory - Memory limit (e.g., '512M')
 */

/**
 * @typedef {Object} DeployConfig
 * @property {ResourceSpec} limits - Resource limits
 * @property {ResourceSpec} reservations - Resource reservations
 * @property {number|null} replicas - Number of replicas
 * @property {string|null} restartPolicy - Restart policy from deploy
 */

// ─── Runtime Metadata (from Dockerfile enrichment) ──────────────────────────

/**
 * @typedef {Object} RuntimeMetadata
 * @property {string|null} resolvedImage - Base image from Dockerfile (when using build)
 * @property {PortBinding[]} resolvedPorts - EXPOSE ports from Dockerfile
 * @property {boolean} enriched - Whether Dockerfile enrichment has been applied
 */

// ─── Service Node (the core entity) ────────────────────────────────────────

/**
 * @typedef {Object} ServiceNode
 * @property {string} id - Service name (unique within project)
 * @property {string|null} image - Explicit image reference
 * @property {BuildInfo|null} build - Build configuration
 * @property {string|null} containerName - Explicit container name
 * @property {PortBinding[]} ports - Parsed port bindings
 * @property {Dependency[]} dependencies - Normalized depends_on
 * @property {NetworkAttachment[]} networks - Network attachments
 * @property {PersistenceMount[]} volumes - Volume/bind mounts
 * @property {string[]} secrets - Secret names attached
 * @property {string[]} configs - Config names attached
 * @property {Object<string, string>} environment - Resolved environment variables
 * @property {string[]} envFiles - env_file paths
 * @property {string[]} profiles - Profile memberships
 * @property {Healthcheck|null} healthcheck - Health check config
 * @property {DeployConfig|null} deploy - Deploy configuration
 * @property {string|null} restart - Restart policy
 * @property {string|null} user - User specification
 * @property {boolean} privileged - Whether running privileged
 * @property {Object<string, string>} labels - Service labels
 * @property {ServiceClassification} classification - Computed tier/role
 * @property {RuntimeMetadata} runtime - Dockerfile-derived metadata
 * @property {Object} _raw - Original raw service object (for round-tripping/export)
 */

// ─── Network Node ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} NetworkNode
 * @property {string} id - Network name
 * @property {string} driver - Network driver (bridge, overlay, host, none, etc.)
 * @property {boolean} external - Whether network is externally managed
 * @property {boolean} internal - Whether network is internal-only
 * @property {boolean} attachable - Whether standalone containers can attach
 * @property {Object<string, string>} labels - Network labels
 * @property {Object} _raw - Original raw network object
 */

// ─── Volume Node ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} VolumeNode
 * @property {string} id - Volume name
 * @property {string} driver - Volume driver
 * @property {Object<string, string>} driverOpts - Driver options
 * @property {boolean} external - Whether volume is externally managed
 * @property {Object<string, string>} labels - Volume labels
 * @property {Object} _raw - Original raw volume object
 */

// ─── Secret Node ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SecretNode
 * @property {string} id - Secret name
 * @property {string|null} file - File path source
 * @property {boolean} external - Whether secret is externally managed
 * @property {Object} _raw - Original raw secret object
 */

// ─── Config Node ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ConfigNode
 * @property {string} id - Config name
 * @property {string|null} file - File path source
 * @property {boolean} external - Whether config is externally managed
 * @property {Object} _raw - Original raw config object
 */

// ─── Compose AST (top-level) ────────────────────────────────────────────────

/**
 * @typedef {Object} ComposeAST
 * @property {string} name - Project name
 * @property {ServiceNode[]} services - All service nodes
 * @property {NetworkNode[]} networks - All network nodes
 * @property {VolumeNode[]} volumes - All volume nodes
 * @property {SecretNode[]} secrets - All secret nodes
 * @property {ConfigNode[]} configs - All config nodes
 * @property {Map<string, ServiceNode>} serviceMap - Quick lookup by service ID
 * @property {Map<string, NetworkNode>} networkMap - Quick lookup by network ID
 * @property {Map<string, VolumeNode>} volumeMap - Quick lookup by volume ID
 */

// Re-export the type names for documentation purposes
export const ASTNodeTypes = Object.freeze({
    SERVICE: 'service',
    NETWORK: 'network',
    VOLUME: 'volume',
    SECRET: 'secret',
    CONFIG: 'config',
});

export const ServiceTiers = Object.freeze({
    INGRESS: 'ingress',
    ROUTING: 'routing',
    APPLICATION: 'application',
    PERSISTENCE: 'persistence',
});

export const ServiceRoles = Object.freeze({
    DATABASE: 'database',
    CACHE: 'cache',
    QUEUE: 'queue',
    PROXY: 'proxy',
    WEBSERVER: 'webserver',
    APPLICATION: 'application',
    MONITORING: 'monitoring',
    STORAGE: 'storage',
});

export const MountTypes = Object.freeze({
    VOLUME: 'volume',
    BIND: 'bind',
    TMPFS: 'tmpfs',
    NPIPE: 'npipe',
    CLUSTER: 'cluster',
});

export const DependencyConditions = Object.freeze({
    STARTED: 'service_started',
    HEALTHY: 'service_healthy',
    COMPLETED: 'service_completed_successfully',
});
