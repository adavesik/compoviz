/**
 * Healthcheck Patterns Library
 *
 * Knowledge base of known healthcheck patterns, fake/useless patterns,
 * weak configuration indicators, and recommended healthchecks per service type.
 */

import { getEffectiveImage } from '../models/astQueries.js';

/**
 * Known fake/useless healthcheck patterns.
 * These commands provide no real health verification.
 */
export const FAKE_PATTERNS = [
    /^\s*sleep\s+\d+/,
    /^\s*exit\s+0/,
    /^\s*true\s*$/,
    /^\s*\/bin\/true\s*$/,
    /^\s*echo\s+/,
];

/**
 * Known weak healthcheck indicators (thresholds).
 */
export const WEAK_INDICATORS = {
    longInterval: 60,      // seconds - interval above this is too infrequent
    lowRetries: 1,         // retries at 1 means single failure = unhealthy
    shortTimeout: 3,       // seconds - timeout below this for complex checks
};

/**
 * Recommended healthcheck commands by service role/image.
 */
export const RECOMMENDED_HEALTHCHECKS = {
    postgres: 'pg_isready -U ${POSTGRES_USER:-postgres}',
    mysql: 'mysqladmin ping -h localhost',
    mariadb: 'mysqladmin ping -h localhost',
    redis: 'redis-cli ping',
    mongo: 'mongosh --eval "db.adminCommand(\'ping\')"',
    nginx: 'curl -f http://localhost/ || exit 1',
    httpd: 'curl -f http://localhost/ || exit 1',
    apache: 'curl -f http://localhost/ || exit 1',
    rabbitmq: 'rabbitmq-diagnostics -q ping',
    elasticsearch: 'curl -f http://localhost:9200/_cluster/health || exit 1',
    memcached: 'echo stats | nc localhost 11211',
};

/**
 * Normalize a Docker healthcheck test array into a single command string.
 *
 * @param {string[]} test - Docker healthcheck test array
 * @returns {string} The effective command string
 */
export function normalizeTestCommand(test) {
    if (!Array.isArray(test) || test.length === 0) return '';

    const prefix = test[0];

    if (prefix === 'CMD-SHELL') {
        return test[1] || '';
    }
    if (prefix === 'CMD') {
        return test.slice(1).join(' ');
    }
    if (prefix === 'NONE') {
        return '';
    }

    // No recognized prefix — treat entire array as the command
    return test.join(' ');
}

/**
 * Get a recommended healthcheck command for a service based on its effective image.
 *
 * @param {object} service - A ServiceNode from the AST
 * @returns {string|null} Recommended command, or null if no recommendation available
 */
export function getRecommendedHealthcheck(service) {
    const image = getEffectiveImage(service);
    if (!image) return null;

    const imageLower = image.toLowerCase();

    for (const [pattern, command] of Object.entries(RECOMMENDED_HEALTHCHECKS)) {
        if (imageLower.includes(pattern)) {
            return command;
        }
    }

    return null;
}
