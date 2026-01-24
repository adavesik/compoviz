/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { generateYaml, parseYaml } from '../utils/yaml';
import { parseEnvFile, mergeEnv } from '../utils/variableInterpolator.js';
import { validateState } from '../utils/validation';
import { generateSuggestions } from '../utils/suggestions';
import { useHistoryReducer } from './useHistory';
import { composeReducer, initialState } from './composeReducer';

// Context
const ComposeContext = createContext(null);

/**
 * ComposeProvider - Manages Docker Compose data state
 * Enhanced with profile and environment variable support
 */
export function ComposeProvider({ children }) {
    // Use history-enabled reducer for undo/redo
    const { state, dispatch, undo, redo, canUndo, canRedo } = useHistoryReducer(composeReducer, initialState);

    // Parser metadata state
    const [profiles, setProfiles] = useState([]);
    const [activeProfiles, setActiveProfiles] = useState([]);
    const [environment, setEnvironment] = useState({});
    const [variables, setVariables] = useState([]);
    const [undefinedVariables, setUndefinedVariables] = useState([]);
    const [parserErrors, setParserErrors] = useState([]);
    const [profileCounts, setProfileCounts] = useState({});
    const [sourceYaml, setSourceYaml] = useState('');
    const lastFilesRef = useRef([]);

    // Generate YAML and errors on state change
    const yamlCode = useMemo(() => generateYaml(state), [state]);
    const errors = useMemo(() => {
        const stateErrors = validateState(state);
        const parserIssues = (parserErrors || []).map((err) => ({
            type: err.type === 'warning' ? 'warning' : 'error',
            entity: 'parser',
            name: err.stage || 'compose',
            message: err.message || 'Parser error'
        }));
        return [...stateErrors, ...parserIssues];
    }, [state, parserErrors]);

    // Generate suggestions on state change
    const suggestions = useMemo(() => generateSuggestions(state), [state]);

    // Load parser metadata from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('docker-compose-state');
        const savedProfiles = localStorage.getItem('docker-compose-active-profiles');
        const savedEnv = localStorage.getItem('docker-compose-environment');

        if (saved) {
            try {
                dispatch({ type: 'SET_STATE', payload: JSON.parse(saved) });
            } catch {
                // Silence loading errors
            }
        }

        if (savedProfiles) {
            try {
                setActiveProfiles(JSON.parse(savedProfiles));
            } catch {
                // Silence errors
            }
        }

        if (savedEnv) {
            try {
                setEnvironment(JSON.parse(savedEnv));
            } catch {
                // Silence errors
            }
        }
    }, [dispatch]);

    // Save to localStorage on state change
    useEffect(() => {
        localStorage.setItem('docker-compose-state', JSON.stringify(state));
    }, [state]);

    // Save active profiles
    useEffect(() => {
        localStorage.setItem('docker-compose-active-profiles', JSON.stringify(activeProfiles));
    }, [activeProfiles]);

    // Save environment
    useEffect(() => {
        localStorage.setItem('docker-compose-environment', JSON.stringify(environment));
    }, [environment]);

    // Action: Load files (import YAML) - Now with Web Worker!
    const loadFiles = useCallback(async (content, files = [], overrides = {}) => {
        try {
            // Build fileMap from uploaded files
            const fileMap = {};
            const effectiveFiles = files.length > 0 ? files : (lastFilesRef.current || []);
            const envFromFiles = {};
            if (effectiveFiles && effectiveFiles.length > 0) {
                for (const file of effectiveFiles) {
                    const path = file.webkitRelativePath || file.name;
                    const text = await file.text();
                    fileMap[path] = text;
                    if (file.name === '.env' || path.endsWith('/.env')) {
                        Object.assign(envFromFiles, parseEnvFile(text));
                    }
                }
            }
            if (effectiveFiles.length > 0) {
                lastFilesRef.current = effectiveFiles;
            }

            const mergedEnvironment = mergeEnv(envFromFiles, overrides.environment || environment);
            const effectiveProfiles = overrides.activeProfiles || activeProfiles;
            if (Object.keys(envFromFiles).length > 0) {
                setEnvironment(mergedEnvironment);
            }

            // Use Web Worker for async parsing
            const { createParserWorker } = await import('../utils/workerManager.js');
            const worker = createParserWorker();

            try {
                const result = await worker.parseAsync(content, {
                    environment: mergedEnvironment,
                    activeProfiles: effectiveProfiles,
                    basePath: effectiveFiles && effectiveFiles.length > 0 && effectiveFiles[0].webkitRelativePath
                        ? effectiveFiles[0].webkitRelativePath.split('/')[0] + '/docker-compose.yml'
                        : 'docker-compose.yml',
                    fileMap,
                    enableIncludes: Object.keys(fileMap).length > 0,
                    enableExtends: true,
                    enableVariables: true,
                    enableProfiles: true,
                    addMetadata: false
                });

                // Update state with parsed compose
                if (result.compose) {
                    dispatch({ type: 'SET_STATE', payload: result.compose });
                }

                // Update parser metadata
                setProfiles(result.profiles || []);
                setProfileCounts(result.profileCounts || {});
                setVariables(result.variables || []);
                setUndefinedVariables(result.undefinedVariables || []);
                setParserErrors(result.errors || []);
                setSourceYaml(content);

                return {
                    success: true,
                    profiles: result.profiles,
                    undefinedVariables: result.undefinedVariables
                };
            } finally {
                worker.terminate();
            }
        } catch (e) {
            console.error('Parser error:', e);

            // Fallback to old parser on error
            try {
                const parsed = parseYaml(content);
                dispatch({ type: 'SET_STATE', payload: parsed });
                setSourceYaml(content);
                setProfiles([]);
                setProfileCounts({});
                setVariables([]);
                setUndefinedVariables([]);
                setParserErrors([]);
                return { success: true, fallback: true };
            } catch {
                return { success: false, error: e.message };
            }
        }
    }, [dispatch, environment, activeProfiles]);

    // Action: Reset project to initial state
    const resetProject = useCallback(() => {
        if (confirm('Are you sure you want to clear all configuration? This cannot be undone.')) {
            dispatch({ type: 'SET_STATE', payload: initialState });
            setActiveProfiles([]);
            setEnvironment({});
            setProfiles([]);
            setVariables([]);
            setUndefinedVariables([]);
            setParserErrors([]);
            return true;
        }
        return false;
    }, [dispatch]);

    // Action: Export YAML file
    const handleExport = useCallback(() => {
        const blob = new Blob([yamlCode], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'docker-compose.yml';
        a.click();
        URL.revokeObjectURL(url);
    }, [yamlCode]);

    // Action: Update YAML code (from editor)
    const handleYamlChange = useCallback(async (newYaml) => {
        // Try new parser first, fallback to old
        try {
            await loadFiles(newYaml);
        } catch {
            // Fallback to simple parsing
            const parsed = parseYaml(newYaml);
            dispatch({ type: 'SET_STATE', payload: parsed });
        }
    }, [dispatch, loadFiles]);

    // Action: Set active profiles (with re-parse)
    const setActiveProfilesAction = useCallback(async (newProfiles) => {
        setActiveProfiles(newProfiles);

        // Re-parse with new profiles if we have YAML
        const yamlForParse = sourceYaml || yamlCode;
        if (yamlForParse) {
            try {
                await loadFiles(yamlForParse, lastFilesRef.current || [], {
                    activeProfiles: newProfiles
                });
            } catch (e) {
                console.error('Failed to re-parse with new profiles:', e);
            }
        }
    }, [yamlCode, sourceYaml, loadFiles]);

    // Action: Update environment variable (with re-parse)
    const updateEnvironment = useCallback(async (key, value) => {
        const updated = { ...environment };
        if (value === null || value === undefined || value === '') {
            delete updated[key];
        } else {
            updated[key] = value;
        }
        setEnvironment(updated);

        // Re-parse with new environment if we have YAML
        const yamlForParse = sourceYaml || yamlCode;
        if (yamlForParse) {
            try {
                const { createParserWorker } = await import('../utils/workerManager.js');
                const worker = createParserWorker();

                try {
                    const fileMap = {};
                    const files = lastFilesRef.current || [];
                    for (const file of files) {
                        const path = file.webkitRelativePath || file.name;
                        fileMap[path] = await file.text();
                    }
                    const result = await worker.parseAsync(yamlForParse, {
                        environment: updated,
                        activeProfiles,
                        fileMap,
                        enableIncludes: Object.keys(fileMap).length > 0,
                        enableExtends: true,
                        enableVariables: true,
                        enableProfiles: true
                    });

                    if (result.compose) {
                        dispatch({ type: 'SET_STATE', payload: result.compose });
                    }
                    setUndefinedVariables(result.undefinedVariables || []);
                    setProfiles(result.profiles || []);
                    setProfileCounts(result.profileCounts || {});
                    setParserErrors(result.errors || []);
                } finally {
                    worker.terminate();
                }
            } catch (e) {
                console.error('Failed to re-parse with new environment:', e);
            }
        }
    }, [environment, yamlCode, sourceYaml, activeProfiles, dispatch]);

    // Action: Bulk set environment (with re-parse)
    const setEnvironmentAction = useCallback(async (newEnv) => {
        setEnvironment(newEnv);

        // Re-parse with new environment if we have YAML
        const yamlForParse = sourceYaml || yamlCode;
        if (yamlForParse) {
            try {
                await loadFiles(yamlForParse, lastFilesRef.current || [], {
                    environment: newEnv
                });
            } catch (e) {
                console.error('Failed to re-parse with new environment:', e);
            }
        }
    }, [yamlCode, sourceYaml, loadFiles]);

    const value = {
        // State
        state,
        yamlCode,
        errors,
        suggestions,

        // Parser metadata
        profiles,
        activeProfiles,
        profileCounts,
        environment,
        variables,
        undefinedVariables,
        parserErrors,

        // Dispatch
        dispatch,

        // History
        undo,
        redo,
        canUndo,
        canRedo,

        // Actions
        loadFiles,
        resetProject,
        handleExport,
        handleYamlChange,
        setActiveProfiles: setActiveProfilesAction,
        updateEnvironment,
        setEnvironment: setEnvironmentAction,
    };

    return (
        <ComposeContext.Provider value={value}>
            {children}
        </ComposeContext.Provider>
    );
}

/**
 * Hook to access the compose context.
 * Must be used within ComposeProvider.
 */
export const useCompose = () => {
    const context = useContext(ComposeContext);
    if (!context) {
        throw new Error('useCompose must be used within ComposeProvider');
    }
    return context;
};
