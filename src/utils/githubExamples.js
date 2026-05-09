/**
 * GitHub-based example fetcher for docker/awesome-compose.
 * Fetches example listings and YAML content on-demand from GitHub's raw content CDN.
 * 
 * Strategy:
 * - Directory listing: fetched once from GitHub Contents API, cached in memory
 * - YAML content: fetched on-demand when user selects an example (raw.githubusercontent.com)
 * - README descriptions: fetched alongside YAML for richer display
 * - No bundling of remote content — everything is fetched at runtime
 * - Graceful fallback if GitHub is unreachable (static examples still work)
 */

const REPO_OWNER = 'docker';
const REPO_NAME = 'awesome-compose';
const BRANCH = 'master';

const CONTENTS_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;

// Directories to skip (not compose examples)
const SKIP_DIRS = new Set([
    '.github', 'official-documentation-samples', 'docs',
]);

// Files that indicate a directory is a compose example
const COMPOSE_FILENAMES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'];

// Known name overrides for better display
const NAME_OVERRIDES = {
    'angular': 'Angular',
    'apache-php': 'Apache + PHP',
    'aspnet-mssql': 'ASP.NET + MSSQL',
    'django': 'Django',
    'elasticsearch-logstash-kibana': 'ELK Stack',
    'fastapi': 'FastAPI',
    'flask': 'Flask',
    'flask-redis': 'Flask + Redis',
    'gitea-postgres': 'Gitea + PostgreSQL',
    'minecraft': 'Minecraft Server',
    'nextcloud-postgres': 'Nextcloud + PostgreSQL',
    'nextcloud-redis-mariadb': 'Nextcloud + Redis + MariaDB',
    'nginx-aspnet-mysql': 'Nginx + ASP.NET + MySQL',
    'nginx-flask-mongo': 'Nginx + Flask + MongoDB',
    'nginx-flask-mysql': 'Nginx + Flask + MySQL',
    'nginx-golang': 'Nginx + Go',
    'nginx-golang-mysql': 'Nginx + Go + MySQL',
    'nginx-golang-postgres': 'Nginx + Go + PostgreSQL',
    'nginx-nodejs-redis': 'Nginx + Node.js + Redis',
    'nginx-wsgi-flask': 'Nginx + WSGI + Flask',
    'pihole-cloudflared-DoH': 'Pi-hole + Cloudflared (DoH)',
    'plex': 'Plex Media Server',
    'portainer': 'Portainer',
    'postgresql-pgadmin': 'PostgreSQL + pgAdmin',
    'prometheus-grafana': 'Prometheus + Grafana',
    'react-express-mongodb': 'React + Express + MongoDB',
    'react-express-mysql': 'React + Express + MySQL',
    'react-java-mysql': 'React + Java + MySQL',
    'react-nginx': 'React + Nginx',
    'react-rust-postgres': 'React + Rust + PostgreSQL',
    'sparkjava': 'Spark Java',
    'sparkjava-mysql': 'Spark Java + MySQL',
    'spring-postgres': 'Spring Boot + PostgreSQL',
    'traefik-golang': 'Traefik + Go',
    'vuejs': 'Vue.js',
    'wasmedge-kafka-mysql': 'WasmEdge + Kafka + MySQL',
    'wasmedge-mysql-nginx': 'WasmEdge + MySQL + Nginx',
    'wireguard': 'WireGuard VPN',
    'wordpress-mysql': 'WordPress + MySQL',
};

/**
 * @typedef {Object} RemoteExample
 * @property {string} id - Directory name (kebab-case)
 * @property {string} name - Human-readable name
 * @property {string} source - GitHub URL to the example directory
 * @property {boolean} isRemote - Always true for remote examples
 * @property {string|null} yaml - null until fetched
 * @property {string|null} description - null until fetched from README
 */

// In-memory caches
let _directoryCache = null;
let _directoryCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// YAML content cache (persists for session)
const _yamlCache = new Map();

/**
 * Fetch the list of available examples from awesome-compose repository.
 * Returns directory names that likely contain compose files.
 * Results are cached for 5 minutes.
 * 
 * @returns {Promise<RemoteExample[]>} Array of remote example entries
 */
export async function fetchRemoteExamplesList() {
    // Return cache if fresh
    if (_directoryCache && (Date.now() - _directoryCacheTime) < CACHE_TTL) {
        return _directoryCache;
    }

    const response = await fetch(CONTENTS_API, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const contents = await response.json();

    // Filter to directories that are likely compose examples
    const examples = contents
        .filter(item => item.type === 'dir' && !SKIP_DIRS.has(item.name) && !item.name.startsWith('.'))
        .map(item => ({
            id: item.name,
            name: NAME_OVERRIDES[item.name] || formatDirName(item.name),
            source: item.html_url,
            isRemote: true,
            yaml: null,
            description: null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Cache the result
    _directoryCache = examples;
    _directoryCacheTime = Date.now();

    return examples;
}

/**
 * Fetch the compose YAML content for a specific remote example.
 * Tries multiple common compose filenames.
 * Results are cached for the session.
 * 
 * @param {string} dirName - The directory name in awesome-compose
 * @returns {Promise<string>} The raw YAML content
 * @throws {Error} If no compose file is found
 */
export async function fetchRemoteExampleYaml(dirName) {
    // Check cache first
    if (_yamlCache.has(dirName)) {
        return _yamlCache.get(dirName);
    }

    // Try each possible compose filename
    for (const filename of COMPOSE_FILENAMES) {
        const url = `${RAW_BASE}/${dirName}/${filename}`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                const yaml = await response.text();
                _yamlCache.set(dirName, yaml);
                return yaml;
            }
        } catch {
            // Try next filename
            continue;
        }
    }

    throw new Error(`No compose file found in "${dirName}". Tried: ${COMPOSE_FILENAMES.join(', ')}`);
}

/**
 * Fetch the README description for a remote example.
 * Extracts the first meaningful paragraph from the README.
 * 
 * @param {string} dirName - The directory name in awesome-compose
 * @returns {Promise<string|null>} Short description or null
 */
export async function fetchRemoteExampleDescription(dirName) {
    const url = `${RAW_BASE}/${dirName}/README.md`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const text = await response.text();
        return extractDescription(text);
    } catch {
        return null;
    }
}

/**
 * Extract a short description from README markdown content.
 * Looks for the first paragraph after the title.
 * 
 * @param {string} markdown - Raw README content
 * @returns {string|null} First meaningful paragraph or null
 */
function extractDescription(markdown) {
    const lines = markdown.split('\n');
    let foundTitle = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and badges
        if (!trimmed || trimmed.startsWith('![') || trimmed.startsWith('[![')) continue;

        // Skip title lines
        if (trimmed.startsWith('#')) {
            foundTitle = true;
            continue;
        }

        // First non-empty, non-title, non-badge line after title
        if (foundTitle && trimmed.length > 10) {
            // Clean up markdown formatting
            return trimmed
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
                .replace(/[*_`]/g, '') // Remove bold/italic/code markers
                .slice(0, 150); // Cap at 150 chars
        }
    }

    return null;
}

/**
 * Convert a directory name like "nginx-golang-postgres" to "Nginx Golang Postgres"
 * Used as fallback when no NAME_OVERRIDE exists.
 * 
 * @param {string} dirName
 * @returns {string}
 */
function formatDirName(dirName) {
    return dirName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/\bMysql\b/g, 'MySQL')
        .replace(/\bMongodb\b/g, 'MongoDB')
        .replace(/\bPostgresql\b/g, 'PostgreSQL')
        .replace(/\bPostgres\b/g, 'PostgreSQL')
        .replace(/\bNodejs\b/g, 'Node.js')
        .replace(/\bVuejs\b/g, 'Vue.js')
        .replace(/\bReactjs\b/g, 'React.js')
        .replace(/\bGolang\b/g, 'Go')
        .replace(/\bFastapi\b/g, 'FastAPI')
        .replace(/\bMssql\b/g, 'MSSQL')
        .replace(/\bAspnet\b/g, 'ASP.NET')
        .replace(/\bPgadmin\b/g, 'pgAdmin')
        .replace(/\bDoh\b/g, 'DoH')
        .replace(/\bWsgi\b/g, 'WSGI')
        .trim();
}

/**
 * Clear all caches (useful for testing or forced refresh)
 */
export function clearCache() {
    _directoryCache = null;
    _directoryCacheTime = 0;
    _yamlCache.clear();
}
