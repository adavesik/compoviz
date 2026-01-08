import { useReducer, createContext, useContext } from 'react';

// Initial State - Following modern Compose Specification
// Note: `version` is obsolete, `name` is the project identifier
export const initialState = {
    name: '',
    services: {},
    networks: {},
    volumes: {},
    secrets: {},
    configs: {},
};

// Reducer
export function composeReducer(state, action) {
    switch (action.type) {
        case 'SET_STATE': {
            const payload = action.payload || {};
            const normalize = (items) => {
                if (!items || typeof items !== 'object') return {};
                const result = {};
                for (const [k, v] of Object.entries(items)) {
                    if (v && typeof v === 'object') result[k] = v;
                    else result[k] = {}; // Ensure each entry is an object
                }
                return result;
            };
            return {
                name: payload.name || '',
                services: normalize(payload.services),
                networks: normalize(payload.networks),
                volumes: normalize(payload.volumes),
                secrets: normalize(payload.secrets),
                configs: normalize(payload.configs),
            };
        }
        case 'ADD_SERVICE': return { ...state, services: { ...state.services, [action.name]: { image: '', ports: [], environment: {}, depends_on: [], networks: [], volumes: [], labels: {}, deploy: { resources: { limits: {}, reservations: {} } }, healthcheck: {} } } };
        case 'UPDATE_SERVICE': return { ...state, services: { ...state.services, [action.name]: { ...state.services[action.name], ...action.data } } };
        case 'DELETE_SERVICE': { const { [action.name]: _, ...rest } = state.services; return { ...state, services: rest }; }
        case 'RENAME_SERVICE': { const { [action.oldName]: svc, ...rest } = state.services; return { ...state, services: { ...rest, [action.newName]: svc } }; }
        case 'ADD_NETWORK': return { ...state, networks: { ...state.networks, [action.name]: { driver: 'bridge', external: false, labels: {} } } };
        case 'UPDATE_NETWORK': return { ...state, networks: { ...state.networks, [action.name]: { ...state.networks[action.name], ...action.data } } };
        case 'DELETE_NETWORK': { const { [action.name]: _, ...rest } = state.networks; return { ...state, networks: rest }; }
        case 'ADD_VOLUME': return { ...state, volumes: { ...state.volumes, [action.name]: { driver: 'local', external: false, driver_opts: {} } } };
        case 'UPDATE_VOLUME': return { ...state, volumes: { ...state.volumes, [action.name]: { ...state.volumes[action.name], ...action.data } } };
        case 'DELETE_VOLUME': { const { [action.name]: _, ...rest } = state.volumes; return { ...state, volumes: rest }; }
        case 'ADD_SECRET': return { ...state, secrets: { ...state.secrets, [action.name]: { file: '', external: false } } };
        case 'UPDATE_SECRET': return { ...state, secrets: { ...state.secrets, [action.name]: { ...state.secrets[action.name], ...action.data } } };
        case 'DELETE_SECRET': { const { [action.name]: _, ...rest } = state.secrets; return { ...state, secrets: rest }; }
        case 'ADD_CONFIG': return { ...state, configs: { ...state.configs, [action.name]: { file: '', external: false } } };
        case 'UPDATE_CONFIG': return { ...state, configs: { ...state.configs, [action.name]: { ...state.configs[action.name], ...action.data } } };
        case 'DELETE_CONFIG': { const { [action.name]: _, ...rest } = state.configs; return { ...state, configs: rest }; }
        default: return state;
    }
}

// Context
export const ComposeContext = createContext(null);

/**
 * Hook to access the compose context.
 * @returns {{state: object, dispatch: function}} The compose state and dispatch function.
 */
export const useCompose = () => useContext(ComposeContext);

/**
 * Hook to create the compose state and dispatch.
 * @returns {{state: object, dispatch: function}} The compose state and dispatch function.
 */
export const useComposeState = () => {
    const [state, dispatch] = useReducer(composeReducer, initialState);
    return { state, dispatch };
};
