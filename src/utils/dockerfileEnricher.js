/**
 * Dockerfile enricher module.
 * Orchestrates enrichment of compose state with Dockerfile metadata
 * for all services that have build directives.
 *
 * @module dockerfileEnricher
 */

import { fetchDockerfile } from './dockerfileFetcher.js';
import { parseDockerfile } from './dockerfileParser.js';

/**
 * @typedef {Object} EnrichOptions
 * @property {Object} fileMap - Local file map from folder upload
 * @property {string|null} exampleDir - Remote example directory name (for GitHub fetch)
 * @property {number} timeout - Per-service timeout in ms (default: 5000)
 */

/**
 * Default per-service timeout in milliseconds.
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Enrich a single service with Dockerfile metadata.
 * Resolves the build context, fetches the Dockerfile, parses it,
 * and attaches _resolvedImage and _resolvedPorts fields.
 *
 * @param {Object} service - The service object from compose state
 * @param {EnrichOptions} options - Fetch options
 * @returns {Promise<void>}
 */
async function enrichService(service, options) {
  const build = service.build;

  // Resolve context path and dockerfile name from build directive
  let contextPath;
  let dockerfileName = 'Dockerfile';
  let target = null;

  if (typeof build === 'string') {
    contextPath = build;
  } else if (build && typeof build === 'object') {
    contextPath = build.context;
    if (build.dockerfile) {
      dockerfileName = build.dockerfile;
    }
    if (build.target) {
      target = build.target;
    }
  } else {
    return;
  }

  if (!contextPath) return;

  const content = await fetchDockerfile(contextPath, dockerfileName, options);
  if (!content) return;

  const metadata = parseDockerfile(content, target);
  if (!metadata) return;

  if (metadata.baseImage) {
    service._resolvedImage = metadata.baseImage;
  }

  if (metadata.exposedPorts && metadata.exposedPorts.length > 0 && !service.ports) {
    service._resolvedPorts = metadata.exposedPorts;
  }
}

/**
 * Enrich compose state with Dockerfile metadata for all services with build directives.
 * Mutates the state object in place (adds _resolvedImage, _resolvedPorts fields).
 * Services that already have an explicit `image` field are skipped.
 * Uses Promise.allSettled so one service failure doesn't block others.
 * Each service enrichment is wrapped in a Promise.race with a timeout.
 *
 * @param {Object} state - Parsed compose state (services, networks, etc.)
 * @param {EnrichOptions} [options={}] - Enrichment options
 * @returns {Promise<Object>} The enriched state (same reference, mutated)
 */
export async function enrichComposeState(state, options = {}) {
  try {
    if (!state || !state.services || typeof state.services !== 'object') {
      return state;
    }

    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const serviceEntries = Object.entries(state.services);

    const promises = serviceEntries.map(([, service]) => {
      // Skip services without a build directive
      if (!service.build) {
        return Promise.resolve();
      }

      // Skip services that already have an explicit image field
      if (service.image) {
        return Promise.resolve();
      }

      // Wrap enrichment in Promise.race with timeout
      const enrichmentPromise = enrichService(service, options);
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(resolve, timeout);
      });

      return Promise.race([enrichmentPromise, timeoutPromise]);
    });

    await Promise.allSettled(promises);

    return state;
  } catch {
    // Never throw — return state unchanged on any unexpected error
    return state;
  }
}
