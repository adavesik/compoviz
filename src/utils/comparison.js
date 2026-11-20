import { normalizeToAST } from '../models/normalizeToAST.js';
import { MountTypes } from '../models/ComposeAST.js';

/**
 * Represents a conflict or shared resource between projects.
 * @typedef {Object} ComparisonResult
 * @property {string} type - 'conflict' | 'shared'
 * @property {string} category - 'port' | 'volume' | 'network' | 'container_name' | 'service_name' | 'env_file'
 * @property {string} severity - 'error' | 'warning' | 'info'
 * @property {string} message - Human-readable description
 * @property {string[]} projects - Names of projects involved
 * @property {any} details - Additional context
 */

/**
 * Extract host binding (IP:Port) from a port mapping string.
 * Returns the full binding specification to properly detect conflicts.
 * Ports bound to different IPs (e.g., 127.0.0.1:80 vs 0.0.0.0:80) don't conflict.
 * Supports IPv4, IPv6 (with/without brackets), and all Docker Compose port formats.
 * @param {string} portMapping - e.g., "8080:80", "127.0.0.1:3000:3000/tcp", "[::1]:8080:80"
 * @returns {string|null} The host binding (IP:Port) or null
 */
export const extractHostPort = (portMapping) => {
    if (!portMapping || typeof portMapping !== 'string') return null;

    let ip, hostPort;

    // Handle IPv6 with square brackets: [::1]:8080:80 or [::1]:8080
    if (portMapping.startsWith('[')) {
        const closeBracket = portMapping.indexOf(']');
        if (closeBracket === -1) return null; // Invalid format

        ip = portMapping.substring(0, closeBracket + 1); // Include brackets
        const remaining = portMapping.substring(closeBracket + 1);

        // Parse remaining part after IPv6
        if (remaining.startsWith(':')) {
            const remainingParts = remaining.substring(1).split(':');
            if (remainingParts.length >= 1) {
                // Format: [::1]:HOST:CONTAINER or [::1]:CONTAINER
                hostPort = remainingParts[0];
            } else {
                return null;
            }
        } else {
            return null; // Invalid format
        }
    } else {
        // Handle IPv4 or IPv6 without brackets
        const parts = portMapping.split(':');

        if (parts.length === 2) {
            // Format: HOST:CONTAINER (no IP specified, binds to all interfaces)
            ip = '0.0.0.0';
            hostPort = parts[0];
        } else if (parts.length === 3) {
            // Format: IP:HOST:CONTAINER (IPv4)
            if (parts[0] === '' && parts[1] === '') {
                // Starts with ::, likely IPv6 like ::1:8080:80
                return null; // Skip ambiguous IPv6 without brackets
            }
            ip = parts[0];
            hostPort = parts[1];
        } else if (parts.length > 3) {
            // Likely IPv6 without brackets
            return null;
        } else {
            // Single part, just container port
            return null;
        }
    }

    if (!hostPort) return null;

    // Remove protocol suffix if present (e.g., "80/tcp" → "80")
    hostPort = hostPort.split('/')[0];

    // Return full binding specification
    return `${ip}:${hostPort}`;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const WILDCARD_IPS = new Set(['', '0.0.0.0', '::', '[::]']);
const MAX_RANGE_EXPANSION = 1024;

/**
 * Normalize a project name the same way Docker Compose does
 * (lowercase, only [a-z0-9_-], must start with a letter or digit).
 */
export const normalizeProjectName = (name) => {
    const normalized = String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
    return normalized.replace(/^[^a-z0-9]+/, '');
};

/** Compose project name actually used at runtime for a compare project. */
export const getEffectiveProjectName = (project) =>
    normalizeProjectName(project?.content?.name || project?.name || '');

const isHostPathSource = (source) =>
    typeof source === 'string' && (source.startsWith('.') || source.startsWith('/') || source.startsWith('~'));

/** Expand "8000-8002" → [8000, 8001, 8002]. Returns [] for unparseable values. */
const expandPortRange = (value) => {
    const str = String(value ?? '').trim();
    if (!str) return [];
    const range = str.match(/^(\d+)-(\d+)$/);
    if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (end < start || end - start > MAX_RANGE_EXPANSION) return [start];
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    return /^\d+$/.test(str) ? [Number(str)] : [];
};

/**
 * Whether a raw port entry publishes a fixed host port.
 * "80" (container port only) and long syntax without `published`
 * get an ephemeral host port and can never collide.
 */
const publishesFixedHostPort = (rawPort) => {
    if (rawPort && typeof rawPort === 'object') {
        return rawPort.published !== undefined && rawPort.published !== null && rawPort.published !== '';
    }
    const str = String(rawPort ?? '').replace(/\/(tcp|udp|sctp)$/i, '');
    if (str.startsWith('[')) {
        // [ip]:host:container or [ip]:container
        const rest = str.slice(str.indexOf(']') + 2);
        return rest.includes(':');
    }
    return str.includes(':');
};

const formatBinding = (ip, port) => {
    const host = ip || '0.0.0.0';
    return host.includes(':') && !host.startsWith('[') ? `[${host}]:${port}` : `${host}:${port}`;
};

const ipsOverlap = (a, b) => a === b || WILDCARD_IPS.has(a) || WILDCARD_IPS.has(b);

const uniq = (arr) => [...new Set(arr)];

const makeResult = ({ category, key, ...rest }) => ({
    id: `${category}:${key}`,
    category,
    key,
    ...rest,
});

const summarizeProjects = (usages) => ({
    projects: uniq(usages.map(u => u.project)),
    projectIds: uniq(usages.map(u => u.projectId)),
});

// ─── Main comparison ───────────────────────────────────────────────────────

/**
 * Compare multiple projects and detect conflicts and shared resources.
 *
 * Every result carries:
 *  - `id`        stable identifier (`category:key`) used for selection / dismissal
 *  - `key`       the conflicting value (binding, name, path, …)
 *  - `projects`  project names, `projectIds` project ids
 *  - `details`   array of usages `{ projectId, project, service?, mapping?, ... }`
 *
 * @param {Array<{id: string, name: string, content: object}>} projects
 * @returns {ComparisonResult[]}
 */
export function compareProjects(projects) {
    const results = [];
    if (!projects || projects.length < 2) return results;

    const entries = projects.map((project, index) => ({
        projectId: project.id ?? `project-${index}`,
        project: project.name,
        runtimeName: getEffectiveProjectName(project),
        content: project.content || {},
        ast: normalizeToAST(project.content || {}),
    }));

    // ── Compose project name collision ──
    const runtimeNames = new Map();
    for (const e of entries) {
        if (!e.runtimeName) continue;
        if (!runtimeNames.has(e.runtimeName)) runtimeNames.set(e.runtimeName, []);
        runtimeNames.get(e.runtimeName).push({ projectId: e.projectId, project: e.project });
    }
    for (const [runtimeName, usages] of runtimeNames) {
        if (usages.length < 2) continue;
        results.push(makeResult({
            type: 'conflict',
            category: 'project_name',
            severity: 'error',
            key: runtimeName,
            message: `Compose project name "${runtimeName}" is used by multiple projects`,
            explanation: 'Docker Compose identifies stacks by project name. Running these files would treat them as one project: containers overwrite each other and "--remove-orphans" deletes the other stack.',
            ...summarizeProjects(usages),
            details: usages,
        }));
    }

    // ── Collect per-service data ──
    const portUsages = new Map(); // `${proto}/${port}` -> [{...}]
    const containerNames = new Map();
    const serviceNames = new Map();
    const hostPaths = new Map();
    const namedVolumes = new Map();
    const envFiles = new Map();

    const push = (map, key, value) => {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(value);
    };

    for (const e of entries) {
        const rawServices = e.content.services || {};
        for (const service of e.ast.services) {
            const base = { projectId: e.projectId, project: e.project, service: service.id };
            push(serviceNames, service.id, base);

            if (service.containerName) push(containerNames, service.containerName, base);

            const rawPorts = Array.isArray(rawServices[service.id]?.ports) ? rawServices[service.id].ports : [];
            service.ports.forEach((port, portIndex) => {
                if (!publishesFixedHostPort(rawPorts[portIndex] ?? port.raw)) return;
                const hostIp = port.hostIp || '0.0.0.0';
                const protocol = (port.protocol || 'tcp').toLowerCase();
                for (const hostPort of expandPortRange(port.hostPort)) {
                    push(portUsages, `${protocol}/${hostPort}`, {
                        ...base, mapping: port.raw, portIndex, hostIp, hostPort, protocol,
                    });
                }
            });

            for (const vol of service.volumes) {
                if (!vol.source) continue;
                if (vol.type === MountTypes.BIND || isHostPathSource(vol.source)) {
                    push(hostPaths, vol.source, { ...base, mapping: vol.raw, readOnly: !!vol.readOnly });
                } else if (vol.type === MountTypes.VOLUME || !vol.type) {
                    push(namedVolumes, vol.source, { ...base, mapping: vol.raw });
                }
            }

            for (const envFile of service.envFiles) push(envFiles, envFile, { ...base, mapping: envFile });
        }
    }

    // ── Port conflicts (IP-aware, protocol-aware, wildcard-aware) ──
    for (const [portKey, usages] of portUsages) {
        if (uniq(usages.map(u => u.projectId)).length < 2) continue;
        const involved = new Set();
        for (let i = 0; i < usages.length; i++) {
            for (let j = i + 1; j < usages.length; j++) {
                const a = usages[i];
                const b = usages[j];
                if (a.projectId !== b.projectId && ipsOverlap(a.hostIp, b.hostIp)) {
                    involved.add(i);
                    involved.add(j);
                }
            }
        }
        if (involved.size === 0) continue;

        const conflicting = usages.filter((_, i) => involved.has(i));
        // Collapse port ranges: one usage entry per (project, service, mapping)
        const deduped = [];
        const seen = new Set();
        for (const u of conflicting) {
            const k = `${u.projectId}|${u.service}|${u.portIndex}`;
            if (!seen.has(k)) { seen.add(k); deduped.push(u); }
        }
        const [protocol, hostPort] = portKey.split('/');
        const ips = uniq(deduped.map(u => u.hostIp));
        const binding = ips.length === 1 ? formatBinding(ips[0], hostPort) : `*:${hostPort}`;
        const protoSuffix = protocol === 'tcp' ? '' : `/${protocol}`;

        results.push(makeResult({
            type: 'conflict',
            category: 'port',
            severity: 'error',
            key: `${binding}${protoSuffix}`,
            port: Number(hostPort),
            protocol,
            message: `Port binding ${binding}${protoSuffix} is used by multiple projects`,
            explanation: ips.length === 1
                ? 'Only one container can bind a host port at a time. The second stack will fail with "port is already allocated".'
                : 'A wildcard binding (0.0.0.0 / ::) overlaps every specific IP on the same port, so these bindings collide.',
            ...summarizeProjects(deduped),
            details: deduped,
        }));
    }

    // ── Container name conflicts (container names are global per Docker host) ──
    for (const [name, usages] of containerNames) {
        if (uniq(usages.map(u => u.projectId)).length < 2) continue;
        results.push(makeResult({
            type: 'conflict',
            category: 'container_name',
            severity: 'error',
            key: name,
            message: `Container name "${name}" is used by multiple projects`,
            explanation: 'container_name is global on a Docker host. The second stack fails with "container name is already in use".',
            ...summarizeProjects(usages),
            details: usages,
        }));
    }

    // ── Host path bind mounts ──
    for (const [source, usages] of hostPaths) {
        if (uniq(usages.map(u => u.projectId)).length < 2) continue;
        const allReadOnly = usages.every(u => u.readOnly);
        results.push(makeResult({
            type: allReadOnly ? 'shared' : 'conflict',
            category: 'volume',
            severity: allReadOnly ? 'info' : 'warning',
            key: source,
            message: `Host path "${source}" is mounted by multiple projects`,
            explanation: allReadOnly
                ? 'All mounts are read-only, so sharing is safe.'
                : 'Relative paths resolve against each compose file\'s directory, so they may or may not be the same folder. If they are, concurrent writers can corrupt data.',
            ...summarizeProjects(usages),
            details: usages,
        }));
    }

    // ── Named volumes: project-scoped unless external or explicitly named ──
    const volumeRuntimeName = (entry, volName) => {
        const node = entry.ast.volumeMap?.get(volName);
        const raw = entry.content.volumes?.[volName];
        const explicitName = raw && typeof raw === 'object' && typeof raw.name === 'string' ? raw.name : null;
        if (node?.external) return explicitName || volName;
        return explicitName || `${entry.runtimeName}_${volName}`;
    };
    for (const [volName, usages] of namedVolumes) {
        if (uniq(usages.map(u => u.projectId)).length < 2) continue;
        const runtime = uniq(usages.map(u => volumeRuntimeName(entries.find(e => e.projectId === u.projectId), volName)));
        const reallyShared = runtime.length === 1;
        results.push(makeResult({
            type: reallyShared ? 'shared' : 'isolated',
            category: 'volume',
            severity: 'info',
            key: volName,
            message: reallyShared
                ? `Volume "${volName}" is shared by multiple projects`
                : `Volume "${volName}" is used by multiple projects but each gets its own copy`,
            explanation: reallyShared
                ? 'All projects resolve to the same Docker volume, so data is shared between stacks.'
                : `Compose prefixes volumes with the project name (${runtime.join(', ')}), so data is NOT shared. Use "external" or an explicit "name" if sharing is intended.`,
            ...summarizeProjects(usages),
            details: usages,
        }));
    }

    // ── Networks: project-scoped unless external or explicitly named ──
    const networkUsages = new Map();
    for (const e of entries) {
        const attachedBy = new Map();
        for (const service of e.ast.services) {
            for (const att of service.networks) {
                if (!attachedBy.has(att.network)) attachedBy.set(att.network, []);
                attachedBy.get(att.network).push(service.id);
            }
        }
        for (const network of e.ast.networks) {
            const raw = e.content.networks?.[network.id];
            const explicitName = raw && typeof raw === 'object' && typeof raw.name === 'string' ? raw.name : null;
            const runtimeName = network.external
                ? (explicitName || network.id)
                : (explicitName || `${e.runtimeName}_${network.id}`);
            const services = attachedBy.get(network.id) || [];
            push(networkUsages, network.id, {
                projectId: e.projectId,
                project: e.project,
                runtimeName,
                external: network.external,
                services,
            });
        }
    }
    for (const [networkName, usages] of networkUsages) {
        if (uniq(usages.map(u => u.projectId)).length < 2) continue;
        const runtime = uniq(usages.map(u => u.runtimeName));
        const reallyShared = runtime.length === 1;
        const details = usages.flatMap(u => (u.services.length > 0
            ? u.services.map(service => ({ ...u, service }))
            : [{ ...u, service: null }]));
        results.push(makeResult({
            type: reallyShared ? 'shared' : 'isolated',
            category: 'network',
            severity: 'info',
            key: networkName,
            runtimeNames: runtime,
            message: reallyShared
                ? `Network "${networkName}" is shared across projects`
                : `Network "${networkName}" is defined in multiple projects but isolated per project`,
            explanation: reallyShared
                ? 'Services from these projects can reach each other over this network.'
                : `Compose creates a separate network per project (${runtime.join(', ')}). Services in different projects cannot reach each other through it.`,
            ...summarizeProjects(usages),
            details,
        }));
    }

    // ── Shared env files ──
    for (const [envFile, usages] of envFiles) {
        if (uniq(usages.map(u => u.projectId)).length < 2) continue;
        results.push(makeResult({
            type: 'shared',
            category: 'env_file',
            severity: 'info',
            key: envFile,
            message: `Env file "${envFile}" is used by multiple projects`,
            explanation: 'Changing this file affects every project that loads it.',
            ...summarizeProjects(usages),
            details: usages,
        }));
    }

    // ── Duplicate service names (informational, Compose namespaces them) ──
    for (const [serviceName, usages] of serviceNames) {
        if (uniq(usages.map(u => u.projectId)).length < 2) continue;
        results.push(makeResult({
            type: 'shared',
            category: 'service_name',
            severity: 'info',
            key: serviceName,
            message: `Service name "${serviceName}" exists in multiple projects`,
            explanation: 'Compose namespaces services per project, so this is fine unless the projects share a network, where the DNS name becomes ambiguous.',
            ...summarizeProjects(usages),
            details: usages,
        }));
    }

    const order = { error: 0, warning: 1, info: 2 };
    return results.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Get comparison summary counts by severity.
 * @param {ComparisonResult[]} results
 * @returns {{errors: number, warnings: number, info: number}}
 */
export function getComparisonSummary(results) {
    return {
        errors: results.filter(r => r.severity === 'error').length,
        warnings: results.filter(r => r.severity === 'warning').length,
        info: results.filter(r => r.severity === 'info').length,
    };
}

/**
 * Index results by `${projectId}::${service}` for quick per-node lookup.
 * @param {ComparisonResult[]} results
 * @returns {Map<string, ComparisonResult[]>}
 */
export function indexResultsByService(results) {
    const index = new Map();
    for (const result of results) {
        const details = Array.isArray(result.details) ? result.details : [];
        for (const d of details) {
            if (!d.service) continue;
            const key = `${d.projectId}::${d.service}`;
            if (!index.has(key)) index.set(key, []);
            const list = index.get(key);
            if (!list.includes(result)) list.push(result);
        }
    }
    return index;
}
