import { useState, useCallback } from 'react';
import { parseYaml } from '../utils/yaml';

/**
 * @typedef {Object} Project
 * @property {string} id - Unique identifier
 * @property {string} name - Project name (from compose file or user)
 * @property {object} content - Parsed compose content
 */

/**
 * Hook for managing multiple compose projects.
 * @returns {Object} Multi-project state and actions
 */
export function useMultiProject() {
    const [projects, setProjects] = useState([]);
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [compareMode, setCompareMode] = useState(false);

    // Generate unique ID
    const generateId = () => `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add a new project from YAML content
    const addProject = useCallback((yamlContent, fileName = 'Untitled') => {
        try {
            const parsed = parseYaml(yamlContent);
            const projectName = parsed?.name || fileName.replace(/\.ya?ml$/i, '') || 'Untitled';

            const newProject = {
                id: generateId(),
                name: projectName,
                content: {
                    name: parsed?.name || '',
                    services: parsed?.services || {},
                    networks: parsed?.networks || {},
                    volumes: parsed?.volumes || {},
                    secrets: parsed?.secrets || {},
                    configs: parsed?.configs || {},
                },
            };

            setProjects(prev => {
                // Limit to 3 projects
                if (prev.length >= 3) {
                    return [...prev.slice(1), newProject];
                }
                return [...prev, newProject];
            });
            setActiveProjectId(newProject.id);
            return { success: true, project: newProject };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }, []);

    // Remove a project
    const removeProject = useCallback((projectId) => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setActiveProjectId(prev => prev === projectId ? (projects[0]?.id || null) : prev);
    }, [projects]);

    // Update a project's content
    const updateProject = useCallback((projectId, content) => {
        setProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, content, name: content.name || p.name } : p
        ));
    }, []);

    // Get active project
    const activeProject = projects.find(p => p.id === activeProjectId) || null;

    // Clear all projects
    const clearAllProjects = useCallback(() => {
        setProjects([]);
        setActiveProjectId(null);
        setCompareMode(false);
    }, []);

    return {
        projects,
        activeProject,
        activeProjectId,
        setActiveProjectId,
        compareMode,
        setCompareMode,
        addProject,
        removeProject,
        updateProject,
        clearAllProjects,
    };
}
