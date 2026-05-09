/* global global */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { fetchDockerfile, clearDockerfileCache } from './dockerfileFetcher';

describe('dockerfileFetcher - Property Tests', () => {
  beforeEach(() => {
    clearDockerfileCache();
    vi.restoreAllMocks();
  });

  /**
   * Property 1: Dockerfile Path Resolution
   *
   * For any build context path (with or without "./" prefix) and any dockerfile name,
   * the fetcher constructs a URL containing the normalized path.
   *
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 6.1, 6.2**
   */
  describe('Property 1: Dockerfile Path Resolution', () => {
    it('constructs a URL combining exampleDir, normalized context, and dockerfile name', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate context paths (with or without ./ prefix)
          fc.oneof(
            fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/),
            fc.stringMatching(/^[a-z][a-z0-9-]{0,20}$/).map(s => `./${s}`)
          ),
          // Generate dockerfile names
          fc.oneof(
            fc.constant('Dockerfile'),
            fc.stringMatching(/^Dockerfile\.[a-z]{1,10}$/)
          ),
          // Generate example directory names
          fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/),
          async (contextPath, dockerfileName, exampleDir) => {
            // Clear cache to avoid cross-iteration interference
            clearDockerfileCache();

            // Track what URL was called
            let calledUrl = null;
            global.fetch = vi.fn().mockImplementation((url) => {
              calledUrl = url;
              return Promise.resolve({ ok: false, status: 404 });
            });

            await fetchDockerfile(contextPath, dockerfileName, { exampleDir });

            // The URL should contain the exampleDir
            expect(calledUrl).toContain(exampleDir);

            // The URL should contain the normalized context (without ./)
            const normalizedContext = contextPath.startsWith('./')
              ? contextPath.slice(2)
              : contextPath;
            expect(calledUrl).toContain(normalizedContext);

            // The URL should contain the dockerfile name
            expect(calledUrl).toContain(dockerfileName);

            // The URL should follow the pattern: base/exampleDir/context/dockerfileName
            const expectedPath = `${exampleDir}/${normalizedContext}/${dockerfileName}`;
            expect(calledUrl).toContain(expectedPath);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 8: Local FileMap Resolution
   *
   * For any fileMap containing a Dockerfile at the matching path,
   * fetchDockerfile returns that content without making network requests.
   *
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Property 8: Local FileMap Resolution', () => {
    it('returns content from fileMap without network requests for any matching path', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate context paths (simple directory names)
          fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
          // Generate dockerfile names
          fc.oneof(
            fc.constant('Dockerfile'),
            fc.stringMatching(/^Dockerfile\.[a-z]{1,8}$/)
          ),
          // Generate file content (non-empty strings)
          fc.string({ minLength: 5, maxLength: 200 }),
          async (contextDir, dockerfileName, rawContent) => {
            // Clear cache to avoid cross-iteration interference
            clearDockerfileCache();

            const fileContent = `FROM node:18\n${rawContent}`;

            // Build the fileMap with the expected key
            const fullPath = `${contextDir}/${dockerfileName}`;
            const fileMap = { [fullPath]: fileContent };

            // Mock fetch to track if it's called
            global.fetch = vi.fn();

            const result = await fetchDockerfile(contextDir, dockerfileName, { fileMap });

            // Should return the content from fileMap
            expect(result).toBe(fileContent);
            // Should NOT make any network requests
            expect(global.fetch).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Fetch Cache Idempotence
   *
   * For any path fetched once, subsequent calls return identical content
   * without additional fetch calls.
   *
   * **Validates: Requirements 1.5**
   */
  describe('Property 10: Fetch Cache Idempotence', () => {
    it('returns identical content on subsequent calls without additional fetch calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate context paths
          fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
          // Generate example directories
          fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
          // Generate file content (non-empty)
          fc.string({ minLength: 5, maxLength: 200 }),
          async (contextDir, exampleDir, rawContent) => {
            // Clear cache for each iteration
            clearDockerfileCache();

            const fileContent = `FROM node:18\n${rawContent}`;

            global.fetch = vi.fn().mockResolvedValue({
              ok: true,
              text: () => Promise.resolve(fileContent),
            });

            const result1 = await fetchDockerfile(contextDir, 'Dockerfile', { exampleDir });
            const result2 = await fetchDockerfile(contextDir, 'Dockerfile', { exampleDir });

            // Both calls return the same content
            expect(result1).toBe(result2);
            // Fetch was only called once
            expect(global.fetch).toHaveBeenCalledTimes(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
