/**
 * @typedef {Object} FromInstruction
 * @property {string} image - The image reference (e.g., "node:18-alpine")
 * @property {string|null} alias - The AS alias (e.g., "builder"), or null
 */

/**
 * @typedef {Object} ExposedPort
 * @property {number} port - The port number
 * @property {string} protocol - The protocol ("tcp" or "udp")
 */

/**
 * @typedef {Object} DockerfileMetadata
 * @property {string|null} baseImage - Resolved FROM image (e.g., "node:18-alpine")
 * @property {Array<ExposedPort>} exposedPorts - EXPOSE ports with protocol
 */

/**
 * Parse Dockerfile content to extract FROM and EXPOSE metadata.
 *
 * When a target is specified, returns the image from the FROM instruction
 * whose AS alias matches the target. Otherwise returns the final FROM image.
 * Never throws — returns safe defaults on any error.
 *
 * @param {string} content - Raw Dockerfile content
 * @param {string|null} [target=null] - Build target stage name (from compose build.target)
 * @returns {DockerfileMetadata}
 */
export function parseDockerfile(content, target = null) {
  try {
    if (!content || typeof content !== 'string') {
      return { baseImage: null, exposedPorts: [] };
    }

    const fromInstructions = extractFromInstructions(content);
    const exposedPorts = extractExposeInstructions(content);

    let baseImage = null;

    if (fromInstructions.length > 0) {
      if (target) {
        // Find the FROM whose alias matches the target
        const matched = fromInstructions.find(
          (f) => f.alias && f.alias.toLowerCase() === target.toLowerCase()
        );
        if (matched) {
          baseImage = matched.image;
        } else {
          // Fallback to final FROM if target not found
          baseImage = fromInstructions[fromInstructions.length - 1].image;
        }
      } else {
        // No target specified — use the final FROM
        baseImage = fromInstructions[fromInstructions.length - 1].image;
      }
    }

    return { baseImage, exposedPorts };
  } catch {
    return { baseImage: null, exposedPorts: [] };
  }
}

/**
 * Extract all FROM instructions from Dockerfile content.
 * Returns array of {image, alias} objects in order of appearance.
 * Skips comment lines and parser directives.
 *
 * @param {string} content - Raw Dockerfile content
 * @returns {Array<FromInstruction>}
 */
export function extractFromInstructions(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const results = [];
  const lines = content.split('\n');

  // Regex: FROM <image> [AS <alias>]
  // image can contain letters, digits, /, -, _, ., :, @, $, {, }
  const fromRegex = /^\s*FROM\s+(\S+)(?:\s+AS\s+(\S+))?\s*$/i;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip comment lines (including parser directives like # syntax=...)
    if (trimmed.startsWith('#')) continue;

    const match = trimmed.match(fromRegex);
    if (match) {
      results.push({
        image: match[1],
        alias: match[2] || null,
      });
    }
  }

  return results;
}

/**
 * Extract all EXPOSE instructions from Dockerfile content.
 * Handles multiple ports per line and optional protocol suffixes.
 * Non-numeric port values are skipped.
 *
 * @param {string} content - Raw Dockerfile content
 * @returns {Array<ExposedPort>}
 */
export function extractExposeInstructions(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const results = [];
  const lines = content.split('\n');

  // Regex to match EXPOSE line (case-insensitive)
  const exposeLineRegex = /^\s*EXPOSE\s+(.+)$/i;
  // Regex to parse individual port entries like "8080", "3000/tcp", "5000/udp"
  const portEntryRegex = /^(\d+)(?:\/(tcp|udp))?$/i;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Skip comment lines
    if (trimmed.startsWith('#')) continue;

    const lineMatch = trimmed.match(exposeLineRegex);
    if (lineMatch) {
      const portsStr = lineMatch[1].trim();
      const entries = portsStr.split(/\s+/);

      for (const entry of entries) {
        const portMatch = entry.match(portEntryRegex);
        if (portMatch) {
          const port = parseInt(portMatch[1], 10);
          const protocol = portMatch[2] ? portMatch[2].toLowerCase() : 'tcp';
          results.push({ port, protocol });
        }
        // Non-numeric or invalid entries are silently skipped
      }
    }
  }

  return results;
}
