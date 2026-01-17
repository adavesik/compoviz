/**
 * Path resolution utilities for multi-file Docker Compose support.
 * Handles file path normalization, joining, and collision detection.
 */

/**
 * Normalize a path by resolving . and .. segments.
 * @param {string} path - Path to normalize
 * @returns {string} Normalized path
 */
export function normalizePath(path) {
    if (!path) return '';

    // Split path into segments
    const segments = path.split('/').filter(Boolean);
    const normalized = [];

    for (const segment of segments) {
        if (segment === '.') {
            // Skip current directory references
            continue;
        } else if (segment === '..') {
            // Go up one directory
            if (normalized.length > 0) {
                normalized.pop();
            }
        } else {
            normalized.push(segment);
        }
    }

    return normalized.join('/');
}

/**
 * Get the directory portion of a path.
 * @param {string} path - File path
 * @returns {string} Directory path
 */
export function dirname(path) {
    if (!path) return '';
    const normalized = normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash === -1 ? '' : normalized.substring(0, lastSlash);
}

/**
 * Join two path segments.
 * @param {string} basePath - Base path
 * @param {string} relativePath - Relative path to join
 * @returns {string} Joined path
 */
export function joinPath(basePath, relativePath) {
    if (!basePath) return normalizePath(relativePath);
    if (!relativePath) return normalizePath(basePath);

    // Remove leading ./ from relative path
    const cleanRelative = relativePath.replace(/^\.\//, '');

    return normalizePath(`${basePath}/${cleanRelative}`);
}

/**
 * Resolve a target path relative to a current file.
 * @param {string} currentFile - Path of the current file
 * @param {string} targetPath - Target path to resolve (may be relative)
 * @returns {string} Absolute normalized path
 */
export function resolvePath(currentFile, targetPath) {
    // Get directory of current file
    const currentDir = dirname(currentFile);

    // Join and normalize
    return joinPath(currentDir, targetPath);
}

/**
 * Create a file map from uploaded files with collision detection.
 * Uses webkitRelativePath when available, falls back to name with collision handling.
 * 
 * @param {Array<{name: string, webkitRelativePath: string, content: string}>} files - Uploaded files
 * @returns {{fileMap: Object<string, string>, collisions: Array<string>}} File map and collision warnings
 */
export function createFileMap(files) {
    const fileMap = {};
    const fileNames = new Map(); // Track name occurrences for collision detection
    const collisions = [];

    for (const file of files) {
        let key = file.webkitRelativePath || file.name;

        // Handle collision when webkitRelativePath is empty
        if (!file.webkitRelativePath) {
            if (fileNames.has(file.name)) {
                // Collision detected
                const count = fileNames.get(file.name);
                key = `upload-${count}/${file.name}`;
                fileNames.set(file.name, count + 1);

                collisions.push(
                    `File name collision detected: "${file.name}". ` +
                    `Auto-prefixed as "${key}". ` +
                    `Consider uploading the entire folder instead of individual files.`
                );
            } else {
                fileNames.set(file.name, 1);
            }
        }

        fileMap[normalizePath(key)] = file.content;
    }

    return { fileMap, collisions };
}

/**
 * Get relative path from one file to another.
 * @param {string} fromPath - Source path
 * @param {string} toPath - Target path
 * @returns {string} Relative path
 */
export function getRelativePath(fromPath, toPath) {
    const fromDir = dirname(normalizePath(fromPath));
    const toNormalized = normalizePath(toPath);

    // If no common directory, return absolute
    if (!fromDir) return toNormalized;

    const fromParts = fromDir.split('/');
    const toParts = toNormalized.split('/');

    // Find common prefix
    let commonLength = 0;
    while (
        commonLength < fromParts.length &&
        commonLength < toParts.length &&
        fromParts[commonLength] === toParts[commonLength]
    ) {
        commonLength++;
    }

    // Build relative path
    const upLevels = fromParts.length - commonLength;
    const relativeParts = Array(upLevels).fill('..');
    const remainingParts = toParts.slice(commonLength);

    return [...relativeParts, ...remainingParts].join('/') || '.';
}
