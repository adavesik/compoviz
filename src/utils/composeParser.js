/**
 * Docker Compose parser orchestrator.
 * Coordinates the multi-stage parsing process.
 */

import yaml from 'js-yaml';
import { resolveIncludes } from './includeResolver.js';
import { resolveAllExtends } from './extendsResolver.js';
import { interpolate, extractVariables, getUndefinedVariables } from './variableInterpolator.js';
import { filterByProfiles, listAllProfiles, getProfileCounts } from './profileFilter.js';

/**
 * Parse Docker Compose YAML with full spec compliance.
 * 
 * Multi-stage parsing process:
 * 1. Parse raw YAML
 * 2. Resolve include directives
 * 3. Resolve extends inheritance
 * 4. Interpolate variables
 * 5. Filter by profiles
 * 6. Validate and extract metadata
 * 
 * @param {string} yamlString - YAML content to parse
 * @param {Object} options - Parser options
 * @param {Object} options.environment - Environment variables for interpolation
 * @param {string[]} options.activeProfiles - Active profile names
 * @param {string} options.basePath - Base file path for includes
 * @param {Object} options.fileMap - Map of file paths to content (for includes)
 * @param {boolean} options.enableIncludes - Enable include resolution (default: true)
 * @param {boolean} options.enableExtends - Enable extends resolution (default: true)
 * @param {boolean} options.enableVariables - Enable variable interpolation (default: true)
 * @param {boolean} options.enableProfiles - Enable profile filtering (default: true)
 * @param {boolean} options.addMetadata - Add variable metadata for UI (default: false)
 * @returns {{compose: Object, profiles: string[], variables: Set<string>, undefinedVariables: string[], errors: Array<{type: string, message: string}>}}
 */
export function parseCompose(yamlString, options = {}) {
    const {
        environment = {},
        activeProfiles = [],
        basePath = 'docker-compose.yml',
        fileMap = {},
        enableIncludes = true,
        enableExtends = true,
        enableVariables = true,
        enableProfiles = true,
        addMetadata = false
    } = options;

    const errors = [];

    try {
        // Stage 1: Parse raw YAML
        let compose = yaml.load(yamlString);

        if (!compose || typeof compose !== 'object') {
            throw new Error('Invalid YAML: expected object at root');
        }

        // Stage 2: Load and merge includes
        if (enableIncludes) {
            try {
                compose = resolveIncludes(compose, basePath, fileMap);
            } catch (error) {
                errors.push({
                    type: 'include',
                    message: error.message,
                    stage: 'include-resolution'
                });
                // Don't throw - continue with what we have
            }
        }

        // Stage 3: Resolve extends inheritance
        if (enableExtends) {
            try {
                compose = resolveAllExtends(compose);
            } catch (error) {
                errors.push({
                    type: 'extends',
                    message: error.message,
                    stage: 'extends-resolution'
                });
                // Don't throw - continue with what we have
            }
        }

        // Extract metadata BEFORE interpolation and filtering
        const allProfiles = listAllProfiles(compose);
        const profileCounts = getProfileCounts(compose);
        const allVariables = enableVariables ? extractVariables(compose) : new Set();
        const undefinedVars = enableVariables ? getUndefinedVariables(compose, environment) : [];

        // Add warnings for undefined variables
        if (undefinedVars.length > 0) {
            errors.push({
                type: 'warning',
                message: `Undefined variables: ${undefinedVars.join(', ')}`,
                stage: 'variable-validation',
                undefinedVariables: undefinedVars
            });
        }

        // Stage 4: Interpolate variables
        if (enableVariables) {
            try {
                const interpolationErrors = new Set();
                compose = interpolate(compose, environment, addMetadata, {
                    throwOnError: false,
                    onError: (error, context) => {
                        const rawMessage = error?.message || 'Variable interpolation error';
                        const varName = context?.varName || '';
                        let message = rawMessage;
                        if (varName) {
                            if (rawMessage === 'required' || rawMessage === 'error') {
                                message = `Missing required variable: ${varName}`;
                            } else if (!rawMessage.includes(varName)) {
                                message = `${rawMessage} (${varName})`;
                            }
                        }
                        const key = `${message}:${varName}`;
                        if (interpolationErrors.has(key)) return;
                        interpolationErrors.add(key);
                        errors.push({
                            type: 'variable',
                            message,
                            stage: 'variable-interpolation'
                        });
                    }
                });
            } catch (error) {
                errors.push({
                    type: 'variable',
                    message: error.message,
                    stage: 'variable-interpolation'
                });
                // Don't throw - continue with what we have
            }
        }

        // Stage 5: Filter by profiles
        if (enableProfiles) {
            compose = filterByProfiles(compose, activeProfiles);
        }

        return {
            compose,
            profiles: allProfiles,
            profileCounts,
            variables: allVariables,
            undefinedVariables: undefinedVars,
            errors
        };

    } catch (error) {
        // Fatal parsing error
        return {
            compose: null,
            profiles: [],
            profileCounts: {},
            variables: new Set(),
            undefinedVariables: [],
            errors: [{
                type: 'fatal',
                message: error.message,
                stage: 'yaml-parsing',
                stack: error.stack
            }]
        };
    }
}

/**
 * Parse Docker Compose YAML synchronously (simple wrapper).
 * For Web Worker usage, see parserWorker.js
 * 
 * @param {string} yamlString - YAML content
 * @param {Object} options - Parser options
 * @returns {Object} Parsed compose configuration
 */
export function parseYaml(yamlString, options = {}) {
    const result = parseCompose(yamlString, options);

    // For backward compatibility, throw on fatal errors
    if (result.errors.some(e => e.type === 'fatal')) {
        const fatalError = result.errors.find(e => e.type === 'fatal');
        throw new Error(fatalError.message);
    }

    return result.compose;
}

/**
 * Validate a parsed compose configuration.
 * 
 * @param {Object} compose - Parsed compose configuration
 * @returns {Array<{type: string, message: string}>} Validation errors
 */
export function validateCompose(compose) {
    const errors = [];

    if (!compose) {
        errors.push({ type: 'error', message: 'Compose configuration is null or undefined' });
        return errors;
    }

    // Check for common issues
    if (compose.services && Object.keys(compose.services).length === 0) {
        errors.push({ type: 'warning', message: 'No services defined' });
    }

    // Validate service definitions
    if (compose.services) {
        for (const [name, service] of Object.entries(compose.services)) {
            if (!service.image && !service.build) {
                errors.push({
                    type: 'error',
                    message: `Service "${name}" must have either "image" or "build" defined`,
                    service: name
                });
            }
        }
    }

    return errors;
}
