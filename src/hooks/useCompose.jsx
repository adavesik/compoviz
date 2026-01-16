/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { generateYaml, parseYaml } from '../utils/yaml';
import { validateState } from '../utils/validation';
import { useHistoryReducer } from './useHistory';
import { initialState, composeReducer } from './composeReducer';

// Context
const ComposeContext = createContext(null);

/**
 * ComposeProvider - Manages Docker Compose data state
 * Handles state, YAML generation, validation, persistence, and actions
 */
export function ComposeProvider({ children }) {
    // Use history-enabled reducer for undo/redo
    const { state, dispatch, undo, redo, canUndo, canRedo } = useHistoryReducer(composeReducer, initialState);

    // Generate YAML and errors on state change
    const yamlCode = useMemo(() => generateYaml(state), [state]);
    const errors = useMemo(() => validateState(state), [state]);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('docker-compose-state');
        if (saved) {
            try {
                dispatch({ type: 'SET_STATE', payload: JSON.parse(saved) });
            } catch {
                // Silence loading errors
            }
        }
    }, [dispatch]);

    // Save to localStorage on state change
    useEffect(() => {
        localStorage.setItem('docker-compose-state', JSON.stringify(state));
    }, [state]);

    // Action: Load files (import YAML)
    const loadFiles = useCallback((content) => {
        try {
            const parsed = parseYaml(content);
            dispatch({ type: 'SET_STATE', payload: parsed });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }, [dispatch]);

    // Action: Reset project to initial state
    const resetProject = useCallback(() => {
        if (confirm('Are you sure you want to clear all configuration? This cannot be undone.')) {
            dispatch({ type: 'SET_STATE', payload: initialState });
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
    const handleYamlChange = useCallback((newYaml) => {
        const parsed = parseYaml(newYaml);
        dispatch({ type: 'SET_STATE', payload: parsed });
    }, [dispatch]);

    const value = {
        // State
        state,
        yamlCode,
        errors,

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
