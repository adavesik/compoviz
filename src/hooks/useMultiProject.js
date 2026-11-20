import { useState, useCallback, useEffect, useRef } from 'react';
import { parseYaml } from '../utils/yaml';
import { applyFixProposal } from '../utils/conflictResolver';

/**
 * @typedef {Object} Project
 * @property {string} id - Unique identifier
 * @property {string} name - Display name (compose `name:` or file name)
 * @property {string} fileName - Original file name (used for downloads)
 * @property {object} content - Current (possibly fixed) compose content
 * @property {object} originalContent - Content as loaded, for "reset changes"
 * @property {boolean} modified - Whether fixes were applied
 */

export const MAX_COMPARE_PROJECTS = 3;
export const COMPARE_STORAGE_KEY = 'compoviz-compare-state';
const HISTORY_LIMIT = 50;

const generateId = () => `project-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const toContent = (parsed) => ({
    name: parsed?.name || '',
    services: parsed?.services || {},
    networks: parsed?.networks || {},
    volumes: parsed?.volumes || {},
    secrets: parsed?.secrets || {},
    configs: parsed?.configs || {},
});

const loadPersisted = () => {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(COMPARE_STORAGE_KEY) : null;
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.projects)) return null;
        return {
            projects: parsed.projects.filter(p => p && p.id && p.content).slice(0, MAX_COMPARE_PROJECTS),
            dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
        };
    } catch {
        return null;
    }
};

/**
 * Hook for managing compare-mode projects.
 * State is persisted to localStorage so it survives switching views.
 */
export function useMultiProject() {
    const [initial] = useState(() => loadPersisted() || { projects: [], dismissed: [] });
    const [projects, setProjectsState] = useState(initial.projects);
    const [dismissed, setDismissed] = useState(initial.dismissed);
    const [past, setPastState] = useState([]);
    const [future, setFutureState] = useState([]);
    const projectsRef = useRef(projects);
    const pastRef = useRef(past);
    const futureRef = useRef(future);

    const setPast = useCallback((next) => { pastRef.current = next; setPastState(next); }, []);
    const setFuture = useCallback((next) => { futureRef.current = next; setFutureState(next); }, []);

    useEffect(() => {
        try {
            localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify({ projects, dismissed }));
        } catch {
            // Storage full or unavailable; compare state just won't persist
        }
    }, [projects, dismissed]);

    /** Replace project list, optionally recording an undo step. */
    const commit = useCallback((updater, { record = true } = {}) => {
        const prev = projectsRef.current;
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (next === prev) return prev;
        if (record) {
            setPast([...pastRef.current.slice(-(HISTORY_LIMIT - 1)), prev]);
            setFuture([]);
        }
        projectsRef.current = next;
        setProjectsState(next);
        return next;
    }, [setPast, setFuture]);

    const addParsedProject = useCallback((parsed, fileName = 'Untitled') => {
        if (projectsRef.current.length >= MAX_COMPARE_PROJECTS) {
            return { success: false, error: `Maximum of ${MAX_COMPARE_PROJECTS} projects. Remove one first.` };
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { success: false, error: 'File is not a valid compose document' };
        }
        if (!parsed.services || typeof parsed.services !== 'object' || Object.keys(parsed.services).length === 0) {
            return { success: false, error: 'No services found in compose file' };
        }
        const content = toContent(parsed);
        const newProject = {
            id: generateId(),
            name: parsed.name || String(fileName).replace(/\.ya?ml$/i, '') || 'Untitled',
            fileName: /\.ya?ml$/i.test(fileName) ? fileName : 'docker-compose.yml',
            content,
            originalContent: content,
            modified: false,
        };
        commit(prev => [...prev, newProject]);
        return { success: true, project: newProject };
    }, [commit]);

    /** Add a project from YAML text. */
    const addProject = useCallback((yamlContent, fileName = 'Untitled') => {
        try {
            return addParsedProject(parseYaml(yamlContent), fileName);
        } catch (e) {
            return { success: false, error: e.message };
        }
    }, [addParsedProject]);

    /** Add a project from an already-parsed compose state (e.g. the editor's project). */
    const addProjectFromState = useCallback((state, fileName = 'editor-project.yml') => {
        return addParsedProject(JSON.parse(JSON.stringify(state || {})), fileName);
    }, [addParsedProject]);

    const removeProject = useCallback((projectId) => {
        commit(prev => prev.filter(p => p.id !== projectId));
    }, [commit]);

    const updateProject = useCallback((projectId, content) => {
        commit(prev => prev.map(p => (p.id === projectId ? { ...p, content, modified: true } : p)));
    }, [commit]);

    const renameProject = useCallback((projectId, name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        commit(prev => prev.map(p => (p.id === projectId ? { ...p, name: trimmed } : p)));
    }, [commit]);

    const resetProject = useCallback((projectId) => {
        commit(prev => prev.map(p => (p.id === projectId && p.originalContent
            ? { ...p, content: p.originalContent, modified: false }
            : p)));
    }, [commit]);

    /** Apply a fix proposal from conflictResolver. */
    const applyFix = useCallback((proposal) => {
        commit(prev => applyFixProposal(prev, proposal));
    }, [commit]);

    const undo = useCallback(() => {
        const p = pastRef.current;
        if (p.length === 0) return;
        const previous = p[p.length - 1];
        setFuture([projectsRef.current, ...futureRef.current]);
        setPast(p.slice(0, -1));
        projectsRef.current = previous;
        setProjectsState(previous);
    }, [setPast, setFuture]);

    const redo = useCallback(() => {
        const f = futureRef.current;
        if (f.length === 0) return;
        const [next, ...rest] = f;
        setPast([...pastRef.current, projectsRef.current]);
        setFuture(rest);
        projectsRef.current = next;
        setProjectsState(next);
    }, [setPast, setFuture]);

    const toggleDismissed = useCallback((resultId) => {
        setDismissed(prev => (prev.includes(resultId) ? prev.filter(id => id !== resultId) : [...prev, resultId]));
    }, []);

    const clearAllProjects = useCallback(() => {
        commit([]);
        setDismissed([]);
    }, [commit]);

    return {
        projects,
        addProject,
        addProjectFromState,
        removeProject,
        updateProject,
        renameProject,
        resetProject,
        applyFix,
        clearAllProjects,
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        dismissed,
        toggleDismissed,
        maxProjects: MAX_COMPARE_PROJECTS,
    };
}
