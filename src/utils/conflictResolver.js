/**
 * Conflict resolver for Compare mode.
 *
 * Turns comparison results into concrete, previewable fix proposals and
 * applies them immutably to raw compose content.
 *
 * A fix proposal:
 * {
 *   id: string,
 *   label: string,          // short action label ("Change host port to 8081")
 *   description: string,    // what will change and why
 *   recommended?: boolean,
 *   changes: Array<{ projectId, project, service?, op, ...params, before?, after? }>
 * }
 */

import { getEffectiveProjectName, normalizeProjectName } from './comparison.js';

const clone = (value) => (typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)));

// ─── Port helpers ──────────────────────────────────────────────────────────

/** Collect every fixed host port number used across all projects. */
export function collectUsedHostPorts(projects) {
    const used = new Set();
    for (const project of projects) {
        for (const svc of Object.values(project.content?.services || {})) {
            for (const port of Array.isArray(svc?.ports) ? svc.ports : []) {
                if (port && typeof port === 'object') {
                    const n = Number(port.published);
                    if (Number.isFinite(n)) used.add(n);
                    continue;
                }
                const str = String(port).replace(/\/(tcp|udp|sctp)$/i, '');
                const parts = str.startsWith('[') ? str.slice(str.indexOf(']') + 2).split(':') : str.split(':');
                if (parts.length < 2) continue;
                const hostPart = parts.length === 3 ? parts[1] : parts[0];
                const range = hostPart.match(/^(\d+)-(\d+)$/);
                if (range) {
                    for (let p = Number(range[1]); p <= Number(range[2]) && p - Number(range[1]) < 1024; p++) used.add(p);
                } else if (/^\d+$/.test(hostPart)) {
                    used.add(Number(hostPart));
                }
            }
        }
    }
    return used;
}

/** Find the next free port after `start`, avoiding `used` and reserving the result. */
export function findFreePort(start, used) {
    let candidate = Math.max(1, Number(start) + 1);
    while (used.has(candidate) && candidate < 65535) candidate++;
    used.add(candidate);
    return candidate;
}

/** Replace the host port in a single port entry (short or long syntax). */
export function rewriteHostPort(port, newHostPort) {
    if (port && typeof port === 'object') {
        return { ...port, published: typeof port.published === 'string' ? String(newHostPort) : newHostPort };
    }
    const str = String(port);
    const protoMatch = str.match(/\/(tcp|udp|sctp)$/i);
    const proto = protoMatch ? protoMatch[0] : '';
    const body = proto ? str.slice(0, -proto.length) : str;

    if (body.startsWith('[')) {
        const close = body.indexOf(']');
        const ip = body.slice(0, close + 1);
        const parts = body.slice(close + 2).split(':');
        const container = parts.length === 2 ? parts[1] : parts[0];
        return `${ip}:${newHostPort}:${container}${proto}`;
    }
    const parts = body.split(':');
    if (parts.length === 3) return `${parts[0]}:${newHostPort}:${parts[2]}${proto}`;
    if (parts.length === 2) return `${newHostPort}:${parts[1]}${proto}`;
    return `${newHostPort}:${parts[0]}${proto}`;
}

/** Bind a published port to loopback only. */
export function rewritePortToLoopback(port) {
    if (port && typeof port === 'object') return { ...port, host_ip: '127.0.0.1' };
    const str = String(port);
    const protoMatch = str.match(/\/(tcp|udp|sctp)$/i);
    const proto = protoMatch ? protoMatch[0] : '';
    const body = proto ? str.slice(0, -proto.length) : str;
    const parts = body.split(':');
    if (parts.length === 2) return `127.0.0.1:${parts[0]}:${parts[1]}${proto}`;
    if (parts.length === 3) return `127.0.0.1:${parts[1]}:${parts[2]}${proto}`;
    return str;
}

const formatPort = (port) => (port && typeof port === 'object' ? JSON.stringify(port) : String(port));

const findPortIndex = (svc, usage) => {
    const ports = Array.isArray(svc?.ports) ? svc.ports : [];
    if (Number.isInteger(usage.portIndex) && ports[usage.portIndex] !== undefined) return usage.portIndex;
    return ports.findIndex(p => formatPort(p) === usage.mapping);
};

// ─── Proposal generation ───────────────────────────────────────────────────

const projectById = (projects, id) => projects.find(p => p.id === id);

/**
 * Pick which usages get modified: keep the first project untouched and
 * change everything in the other projects.
 */
const usagesToChange = (result) => {
    const details = Array.isArray(result.details) ? result.details : [];
    const keeper = details[0]?.projectId;
    return details.filter(d => d.projectId !== keeper);
};

function portProposals(result, projects) {
    const targets = usagesToChange(result);
    if (targets.length === 0) return [];
    const used = collectUsedHostPorts(projects);
    const proposals = [];

    const remap = targets.map(t => {
        const svc = projectById(projects, t.projectId)?.content?.services?.[t.service];
        const index = findPortIndex(svc, t);
        if (index < 0) return null;
        const current = svc.ports[index];
        const next = findFreePort(result.port ?? t.hostPort, used);
        return {
            projectId: t.projectId, project: t.project, service: t.service,
            op: 'set_port', portIndex: index, value: rewriteHostPort(current, next),
            before: formatPort(current), after: formatPort(rewriteHostPort(current, next)),
            newPort: next,
        };
    }).filter(Boolean);

    if (remap.length > 0) {
        const ports = uniqueList(remap.map(c => c.newPort));
        proposals.push({
            id: `${result.id}:remap`,
            label: `Move to free host port ${ports.join(', ')}`,
            description: `Publish ${remap.map(c => `${c.project}/${c.service}`).join(', ')} on the next unused host port. The container port stays the same.`,
            recommended: true,
            changes: remap,
        });
    }

    const remove = targets.map(t => {
        const svc = projectById(projects, t.projectId)?.content?.services?.[t.service];
        const index = findPortIndex(svc, t);
        if (index < 0) return null;
        return {
            projectId: t.projectId, project: t.project, service: t.service,
            op: 'remove_port', portIndex: index, before: formatPort(svc.ports[index]), after: null,
        };
    }).filter(Boolean);
    if (remove.length > 0) {
        proposals.push({
            id: `${result.id}:unpublish`,
            label: 'Stop publishing the port',
            description: 'Remove the host port mapping. The service stays reachable from other containers on the same network.',
            changes: remove,
        });
    }
    return proposals;
}

function containerNameProposals(result, projects) {
    const targets = usagesToChange(result);
    if (targets.length === 0) return [];
    const taken = new Set();
    for (const p of projects) {
        for (const svc of Object.values(p.content?.services || {})) {
            if (svc?.container_name) taken.add(svc.container_name);
        }
    }
    const rename = targets.map(t => {
        const project = projectById(projects, t.projectId);
        const prefix = getEffectiveProjectName(project) || 'project';
        let candidate = `${prefix}-${result.key}`;
        let n = 2;
        while (taken.has(candidate)) candidate = `${prefix}-${result.key}-${n++}`;
        taken.add(candidate);
        return {
            projectId: t.projectId, project: t.project, service: t.service,
            op: 'set_container_name', value: candidate, before: result.key, after: candidate,
        };
    });
    const remove = targets.map(t => ({
        projectId: t.projectId, project: t.project, service: t.service,
        op: 'remove_container_name', before: result.key, after: null,
    }));
    return [
        {
            id: `${result.id}:rename`,
            label: `Rename to "${rename[0].value}"${rename.length > 1 ? ' …' : ''}`,
            description: 'Prefix the container name with the project name so it is unique on the host.',
            recommended: true,
            changes: rename,
        },
        {
            id: `${result.id}:remove`,
            label: 'Remove container_name',
            description: 'Let Compose generate the name (<project>-<service>-1). This also allows scaling the service.',
            changes: remove,
        },
    ];
}

function projectNameProposals(result, projects) {
    const details = Array.isArray(result.details) ? result.details : [];
    const taken = new Set(projects.map(getEffectiveProjectName));
    const changes = details.slice(1).map(d => {
        const project = projectById(projects, d.projectId);
        let n = 2;
        let candidate = `${result.key}-${n}`;
        while (taken.has(candidate)) candidate = `${result.key}-${++n}`;
        taken.add(candidate);
        return {
            projectId: d.projectId, project: d.project,
            op: 'set_project_name', value: candidate,
            before: project?.content?.name || '(from file name)', after: candidate,
        };
    });
    if (changes.length === 0) return [];
    return [{
        id: `${result.id}:rename`,
        label: `Set project name to "${changes[0].value}"${changes.length > 1 ? ' …' : ''}`,
        description: 'Give each stack a distinct top-level `name:` so Compose manages them independently.',
        recommended: true,
        changes,
    }];
}

function hostPathProposals(result) {
    const targets = usagesToChange(result);
    if (targets.length === 0) return [];
    const isRelative = result.key.startsWith('.');
    const changes = targets.map(t => {
        const suffix = normalizeProjectName(t.project) || 'project';
        const newSource = `${result.key.replace(/\/+$/, '')}-${suffix}`;
        return {
            projectId: t.projectId, project: t.project, service: t.service,
            op: 'set_volume_source', match: t.mapping, from: result.key, value: newSource,
            before: t.mapping, after: String(t.mapping).replace(result.key, newSource),
        };
    });
    const readonly = targets.map(t => ({
        projectId: t.projectId, project: t.project, service: t.service,
        op: 'set_volume_readonly', match: t.mapping,
        before: t.mapping, after: typeof t.mapping === 'string' && !t.mapping.endsWith(':ro') ? `${t.mapping}:ro` : t.mapping,
    })).filter(c => typeof c.match === 'string');

    const proposals = [{
        id: `${result.id}:separate`,
        label: 'Use a project-specific path',
        description: isRelative
            ? 'Relative paths are only the same folder if the compose files live in the same directory. Make the intent explicit with a separate folder.'
            : 'Give each project its own host directory to avoid concurrent writes.',
        recommended: true,
        changes,
    }];
    if (readonly.length > 0) {
        proposals.push({
            id: `${result.id}:readonly`,
            label: 'Mount read-only in other projects',
            description: 'Keep sharing the folder, but only the first project may write to it.',
            changes: readonly,
        });
    }
    return proposals;
}

function shareResourceProposals(result, kind) {
    // kind: 'networks' | 'volumes'
    const projectIds = result.projectIds || [];
    const runtimeName = result.key;
    const changes = projectIds.map(projectId => ({
        projectId,
        project: result.details.find(d => d.projectId === projectId)?.project,
        op: kind === 'networks' ? 'set_network_name' : 'set_volume_name',
        resource: result.key,
        value: runtimeName,
        before: `${result.key}: (project-scoped)`,
        after: `${result.key}: { name: ${runtimeName} }`,
    }));
    const external = projectIds.map(projectId => ({
        projectId,
        project: result.details.find(d => d.projectId === projectId)?.project,
        op: kind === 'networks' ? 'set_network_external' : 'set_volume_external',
        resource: result.key,
        value: runtimeName,
        before: `${result.key}: (project-scoped)`,
        after: `${result.key}: { external: true, name: ${runtimeName} }`,
    }));
    const noun = kind === 'networks' ? 'network' : 'volume';
    return [
        {
            id: `${result.id}:share`,
            label: `Share one "${runtimeName}" ${noun}`,
            description: `Set an explicit name so all projects use the same Docker ${noun}. The first stack to start creates it.`,
            recommended: kind === 'networks',
            changes,
        },
        {
            id: `${result.id}:external`,
            label: `Mark as external`,
            description: `Use a pre-created ${noun} (docker ${noun} create ${runtimeName}). No stack owns it, so "down" won't remove it.`,
            changes: external,
        },
    ];
}

/**
 * Build fix proposals for a comparison result.
 * @param {object} result - Comparison result from compareProjects
 * @param {Array} projects - Compare projects ({ id, name, content })
 * @returns {Array} proposals
 */
export function getFixProposals(result, projects) {
    if (!result || !projects) return [];
    switch (result.category) {
        case 'port': return portProposals(result, projects);
        case 'container_name': return containerNameProposals(result, projects);
        case 'project_name': return projectNameProposals(result, projects);
        case 'volume':
            if (result.type === 'conflict') return hostPathProposals(result);
            if (result.type === 'isolated') return shareResourceProposals(result, 'volumes');
            return [];
        case 'network':
            return result.type === 'isolated' ? shareResourceProposals(result, 'networks') : [];
        default:
            return [];
    }
}

function uniqueList(arr) {
    return [...new Set(arr)];
}

// ─── Applying changes ──────────────────────────────────────────────────────

const ensureObjectEntry = (collection, key) => {
    const current = collection[key];
    return current && typeof current === 'object' ? { ...current } : {};
};

/**
 * Apply a single change to compose content. Pure: returns new content.
 * @param {object} content - Raw compose content
 * @param {object} change - Change descriptor from a fix proposal
 */
export function applyChange(content, change) {
    const next = clone(content || {});
    next.services = next.services || {};
    const svc = change.service ? next.services[change.service] : null;

    switch (change.op) {
        case 'set_port': {
            if (!svc || !Array.isArray(svc.ports)) break;
            svc.ports[change.portIndex] = change.value;
            break;
        }
        case 'remove_port': {
            if (!svc || !Array.isArray(svc.ports)) break;
            svc.ports.splice(change.portIndex, 1);
            if (svc.ports.length === 0) delete svc.ports;
            break;
        }
        case 'bind_loopback': {
            if (!svc || !Array.isArray(svc.ports)) break;
            svc.ports[change.portIndex] = rewritePortToLoopback(svc.ports[change.portIndex]);
            break;
        }
        case 'set_container_name': {
            if (svc) svc.container_name = change.value;
            break;
        }
        case 'remove_container_name': {
            if (svc) delete svc.container_name;
            break;
        }
        case 'set_project_name': {
            next.name = change.value;
            break;
        }
        case 'set_volume_source':
        case 'set_volume_readonly': {
            if (!svc || !Array.isArray(svc.volumes)) break;
            svc.volumes = svc.volumes.map(vol => {
                const matches = typeof vol === 'string'
                    ? vol === change.match
                    : JSON.stringify(vol) === change.match || vol?.source === change.from;
                if (!matches) return vol;
                if (change.op === 'set_volume_source') {
                    return typeof vol === 'string'
                        ? vol.replace(change.from, change.value)
                        : { ...vol, source: change.value };
                }
                if (typeof vol === 'string') return vol.endsWith(':ro') ? vol : `${vol}:ro`;
                return { ...vol, read_only: true };
            });
            break;
        }
        case 'set_network_name':
        case 'set_network_external': {
            next.networks = next.networks || {};
            const net = ensureObjectEntry(next.networks, change.resource);
            net.name = change.value;
            if (change.op === 'set_network_external') net.external = true;
            next.networks[change.resource] = net;
            break;
        }
        case 'set_volume_name':
        case 'set_volume_external': {
            next.volumes = next.volumes || {};
            const vol = ensureObjectEntry(next.volumes, change.resource);
            vol.name = change.value;
            if (change.op === 'set_volume_external') vol.external = true;
            next.volumes[change.resource] = vol;
            break;
        }
        default:
            break;
    }
    return next;
}

/**
 * Apply a whole proposal to the project list. Pure: returns new project list.
 * @param {Array} projects
 * @param {object} proposal
 */
export function applyFixProposal(projects, proposal) {
    if (!proposal?.changes?.length) return projects;
    return projects.map(project => {
        const changes = proposal.changes.filter(c => c.projectId === project.id);
        if (changes.length === 0) return project;
        // Apply port changes from highest index first so removals don't shift later indices
        const ordered = [...changes].sort((a, b) => (b.portIndex ?? -1) - (a.portIndex ?? -1));
        const content = ordered.reduce((acc, change) => applyChange(acc, change), project.content);
        return { ...project, content, modified: true };
    });
}
