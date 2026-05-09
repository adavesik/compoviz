/**
 * Dockerfile fetcher module.
 * Fetches Dockerfile content from local file maps or remote GitHub raw URLs,
 * with session-scoped caching and configurable timeouts.
 *
 * @module dockerfileFetcher
 */

/**
 * @typedef {Object} FetchOptions
 * @property {Object} fileMap - Local file map from folder upload
 * @property {string|null} exampleDir - Remote example directory name (e.g., "nginx-flask-mysql")
 * @property {number} timeout - Per-fetch timeout in ms (default: 5000)
 */

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/docker/awesome-compose/master';

/** Session-scoped cache keyed by resolved path */
const _cache = new Map();

/**
 * Normalize a context path by stripping leading "./" prefix.
 *
 * @param {string} contextPath - The build context path (e.g., "./backend" or "backend")
 * @returns {string} Normalized path without leading "./"
 */
function normalizePath(contextPath) {
  if (!contextPath) return '';
  let normalized = contextPath;
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  // Also strip trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Construct the full Dockerfile path from context and filename.
 *
 * @param {string} contextPath - Build context path (e.g., "./backend")
 * @param {string} dockerfileName - Dockerfile name (default: "Dockerfile")
 * @returns {string} Full path like "backend/Dockerfile"
 */
function buildFullPath(contextPath, dockerfileName) {
  const normalized = normalizePath(contextPath);
  if (!normalized || normalized === '.') {
    return dockerfileName;
  }
  return `${normalized}/${dockerfileName}`;
}

/**
 * Attempt to resolve Dockerfile content from a local fileMap.
 * Tries multiple path variations to handle different fileMap key formats.
 *
 * @param {string} fullPath - The normalized full path (e.g., "backend/Dockerfile")
 * @param {Object} fileMap - Local file map
 * @param {string|null} exampleDir - Example directory prefix to try
 * @returns {string|null} File content or null if not found
 */
function resolveFromFileMap(fullPath, fileMap, exampleDir) {
  if (!fileMap || typeof fileMap !== 'object') return null;

  // Try direct path
  if (fileMap[fullPath] !== undefined) {
    return fileMap[fullPath];
  }

  // Try with project prefix (exampleDir)
  if (exampleDir) {
    const withPrefix = `${exampleDir}/${fullPath}`;
    if (fileMap[withPrefix] !== undefined) {
      return fileMap[withPrefix];
    }
  }

  // Try with "./" prefix
  const withDotSlash = `./${fullPath}`;
  if (fileMap[withDotSlash] !== undefined) {
    return fileMap[withDotSlash];
  }

  return null;
}

/**
 * Fetch Dockerfile content for a service's build context.
 * Checks local fileMap first, then falls back to GitHub raw URL.
 * Returns null on any failure (network, 404, timeout) — never throws.
 *
 * @param {string} contextPath - Build context path (e.g., "./backend")
 * @param {string} [dockerfileName="Dockerfile"] - Dockerfile name
 * @param {FetchOptions} [options={}] - Fetch options
 * @returns {Promise<string|null>} Dockerfile content or null
 */
export async function fetchDockerfile(contextPath, dockerfileName = 'Dockerfile', options = {}) {
  try {
    const { fileMap = null, exampleDir = null, timeout = 5000 } = options;
    const fullPath = buildFullPath(contextPath, dockerfileName);

    // Check cache first
    if (_cache.has(fullPath)) {
      return _cache.get(fullPath);
    }

    // Try local fileMap first
    const localContent = resolveFromFileMap(fullPath, fileMap, exampleDir);
    if (localContent !== null) {
      _cache.set(fullPath, localContent);
      return localContent;
    }

    // If no exampleDir, we can't construct a remote URL
    if (!exampleDir) {
      _cache.set(fullPath, null);
      return null;
    }

    // Construct GitHub raw URL
    const url = `${GITHUB_RAW_BASE}/${exampleDir}/${fullPath}`;

    // Fetch with AbortController timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        _cache.set(fullPath, null);
        return null;
      }

      const content = await response.text();
      _cache.set(fullPath, content);
      return content;
    } catch {
      clearTimeout(timeoutId);
      _cache.set(fullPath, null);
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Clear the Dockerfile content cache.
 * Useful for testing or when loading a new project.
 */
export function clearDockerfileCache() {
  _cache.clear();
}
