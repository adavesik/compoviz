/**
 * Docker Compose include resolver.
 * Resolves include directives and merges external Compose files.
 */

import yaml from 'js-yaml';
import { resolvePath, normalizePath } from './pathResolver.js';

/**
 * Merge two Compose files with override semantics.
 * Later values override earlier ones.
 * 
 * @param {Object} base - Base compose configuration
 * @param {Object} override - Override compose configuration
 * @returns {Object} Merged compose configuration
 */
function mergeComposeFiles(base, override) {
    if (!override) return base || {};
    if (!base) return override || {};

    const result = { ...base };

    // Merge top-level fields
    for (const [key, value] of Object.entries(override)) {
        if (key === 'name') {
            // Override wins for project name
            result[key] = value;
        } else if (['services', 'networks', 'volumes', 'secrets', 'configs'].includes(key)) {
            // Merge dictionaries
            result[key] = {
                ...(result[key] || {}),
                ...(value || {})
            };
        } else {
            // Other fields: override wins
            result[key] = value;
        }
    }

    return result;
}

/**
 * Resolve include directives recursively.
 * Loads external files and merges them into the compose configuration.
 * 
 * @param {Object} compose - Compose configuration
 * @param {string} currentFile - Path of current file (for relative resolution)
 * @param {Object} fileMap - Map of file paths to content
 * @param {Set<string>} visited - Set of visited file paths (for circular detection)
 * @returns {Object} Compose configuration with includes resolved
 */
export function resolveIncludes(compose, currentFile, fileMap, visited = new Set()) {
    if (!compose || !compose.include) {
        return compose;
    }

    // Normalize and track current file
    const absoluteCurrent = normalizePath(currentFile);

    // Check circular dependency
    if (visited.has(absoluteCurrent)) {
        throw new Error(`Circular include detected: ${absoluteCurrent} already in chain`);
    }

    const newVisited = new Set(visited);
    newVisited.add(absoluteCurrent);

    let merged = { ...compose };
    delete merged.include; // Remove include directive from result

    // Process each include
    const includes = Array.isArray(compose.include) ? compose.include : [compose.include];

    for (const includeSpec of includes) {
        // Extract path from include specification
        const includePath = typeof includeSpec === 'string'
            ? includeSpec
            : includeSpec.path;

        if (!includePath) {
            console.warn('Invalid include specification:', includeSpec);
            continue;
        }

        // Resolve relative path
        const absoluteInclude = resolvePath(currentFile, includePath);

        // Check circular dependency with absolute path
        if (newVisited.has(absoluteInclude)) {
            throw new Error(
                `Circular include detected: ${Array.from(newVisited).join(' → ')} → ${absoluteInclude}`
            );
        }

        // Load file from fileMap
        const content = fileMap[absoluteInclude];
        if (!content) {
            throw new Error(
                `Include file not found: "${includePath}"\n` +
                `Resolved to: "${absoluteInclude}"\n` +
                `Available files: ${Object.keys(fileMap).join(', ')}`
            );
        }

        // Parse included file
        let included;
        try {
            included = yaml.load(content);
        } catch (error) {
            throw new Error(`Failed to parse included file "${includePath}": ${error.message}`);
        }

        // Recursively resolve includes in the included file
        const resolvedInclude = resolveIncludes(included, absoluteInclude, fileMap, newVisited);

        // Merge with current configuration
        // NOTE: Includes are the base, main file is the override
        merged = mergeComposeFiles(resolvedInclude, merged);
    }

    return merged;
}

/**
 * Check if a compose file has any include directives.
 * 
 * @param {Object} compose - Compose configuration
 * @returns {boolean} True if includes are present
 */
export function hasIncludes(compose) {
    if (!compose || !compose.include) {
        return false;
    }

    return Array.isArray(compose.include) ? compose.include.length > 0 : true;
}
