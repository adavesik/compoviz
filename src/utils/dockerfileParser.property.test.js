import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseDockerfile, extractExposeInstructions } from './dockerfileParser';

/**
 * Property-based tests for the Dockerfile parser.
 * Uses fast-check to verify correctness properties across many random inputs.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.6, 3.1, 3.2, 3.3, 3.4, 7.2
 */
describe('Dockerfile Parser - Property-Based Tests', () => {
  // --- Generators ---

  /** Generate a valid Docker image name from known-good values */
  const arbImageName = () =>
    fc.tuple(
      fc.constantFrom('node', 'python', 'golang', 'nginx', 'redis', 'postgres', 'alpine', 'ubuntu', 'ruby', 'php', 'rust', 'java'),
      fc.option(
        fc.constantFrom('latest', '18', '3.11', 'alpine', '18-alpine', '3.11-slim', '16-bullseye', '8.2', '1.21'),
        { nil: undefined }
      )
    ).map(([name, tag]) => tag ? `${name}:${tag}` : name);

  /** Generate a valid alias name from known-good values */
  const arbAlias = () =>
    fc.constantFrom('builder', 'runner', 'dev', 'prod', 'base', 'deps', 'test', 'stage', 'final', 'app');

  /** Generate a FROM instruction line */
  const arbFromLine = (withAlias = false) =>
    fc.tuple(arbImageName(), withAlias ? arbAlias() : fc.constant(null))
      .map(([image, alias]) => alias ? `FROM ${image} AS ${alias}` : `FROM ${image}`);

  /** Generate a valid port number (1-65535) */
  const arbPort = () => fc.integer({ min: 1, max: 65535 });

  /** Generate a protocol */
  const arbProtocol = () => fc.constantFrom('tcp', 'udp');

  /**
   * Property 2: FROM Instruction Resolution
   *
   * For any valid Dockerfile content with FROM instructions and any target value,
   * parseDockerfile returns the correct image based on target matching or final FROM fallback.
   *
   * Validates: Requirements 2.1, 2.2, 2.3, 2.6
   */
  describe('Property 2: FROM Instruction Resolution', () => {
    it('when target matches an alias, that stage\'s image is returned', () => {
      fc.assert(
        fc.property(
          // Generate 2-5 FROM stages with unique aliases
          fc.integer({ min: 2, max: 5 }).chain(numStages =>
            fc.tuple(
              fc.array(
                arbImageName(),
                { minLength: numStages, maxLength: numStages }
              ),
              fc.integer({ min: 0, max: numStages - 1 })
            )
          ),
          ([images, targetIdx]) => {
            // Create unique aliases by using stage_N pattern
            const stages = images.map((image, i) => [image, `stage${i}`]);

            const content = stages
              .map(([image, alias]) => `FROM ${image} AS ${alias}`)
              .join('\n');

            const target = stages[targetIdx][1];
            const result = parseDockerfile(content, target);

            expect(result.baseImage).toBe(stages[targetIdx][0]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('when target is null, the final FROM\'s image is returned', () => {
      fc.assert(
        fc.property(
          fc.array(arbFromLine(false), { minLength: 1, maxLength: 5 }),
          (fromLines) => {
            const content = fromLines.join('\n');
            const result = parseDockerfile(content, null);

            // Extract the last FROM image manually
            const lastLine = fromLines[fromLines.length - 1];
            const match = lastLine.match(/^FROM\s+(\S+)/i);
            const expectedImage = match ? match[1] : null;

            expect(result.baseImage).toBe(expectedImage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('commented FROM lines are never selected', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            arbImageName(),
            arbImageName()
          ),
          ([commentedImage, realImage]) => {
            const content = [
              `# FROM ${commentedImage} AS target`,
              `FROM ${realImage}`,
            ].join('\n');

            const result = parseDockerfile(content, null);
            expect(result.baseImage).toBe(realImage);

            // Even if target matches the commented alias, it should not be selected
            const resultWithTarget = parseDockerfile(content, 'target');
            // Since 'target' alias is in a comment, it won't match; falls back to last FROM
            expect(resultWithTarget.baseImage).toBe(realImage);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: EXPOSE Instruction Extraction
   *
   * For any Dockerfile with EXPOSE instructions, extractExposeInstructions returns
   * all ports with correct protocol (default tcp). Non-numeric port values are skipped.
   *
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  describe('Property 3: EXPOSE Instruction Extraction', () => {
    it('all ports are extracted with correct protocol', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.array(
              fc.tuple(arbPort(), fc.option(arbProtocol(), { nil: undefined })),
              { minLength: 1, maxLength: 5 }
            ),
            { minLength: 1, maxLength: 5 }
          ),
          (exposeLines) => {
            // Build Dockerfile content
            const content = exposeLines.map(ports => {
              const portStrs = ports.map(([port, proto]) =>
                proto ? `${port}/${proto}` : `${port}`
              );
              return `EXPOSE ${portStrs.join(' ')}`;
            }).join('\n');

            const result = extractExposeInstructions(content);

            // Flatten expected ports
            const expected = exposeLines.flatMap(ports =>
              ports.map(([port, proto]) => ({
                port,
                protocol: proto || 'tcp',
              }))
            );

            expect(result).toEqual(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('non-numeric port values are skipped', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(arbPort(), { minLength: 1, maxLength: 3 }),
            fc.array(
              fc.stringMatching(/^[a-z${}_.][a-z${}_.]{0,7}$/),
              { minLength: 1, maxLength: 3 }
            )
          ),
          ([validPorts, invalidPorts]) => {
            // Mix valid and invalid ports in an EXPOSE line
            const allEntries = [
              ...validPorts.map(p => `${p}`),
              ...invalidPorts,
            ];
            const content = `EXPOSE ${allEntries.join(' ')}`;

            const result = extractExposeInstructions(content);

            // Only valid numeric ports should be extracted
            expect(result.length).toBe(validPorts.length);
            for (let i = 0; i < validPorts.length; i++) {
              expect(result[i].port).toBe(validPorts[i]);
              expect(result[i].protocol).toBe('tcp');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Parser Robustness
   *
   * For any arbitrary string input (including empty, binary-like, random unicode),
   * parseDockerfile never throws an exception.
   *
   * Validates: Requirements 7.2
   */
  describe('Property 9: Parser Robustness', () => {
    it('parseDockerfile never throws for any arbitrary string', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (input) => {
            const result = parseDockerfile(input);
            expect(result).toBeDefined();
            expect(result).toHaveProperty('baseImage');
            expect(result).toHaveProperty('exposedPorts');
            expect(Array.isArray(result.exposedPorts)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('parseDockerfile never throws for strings with special characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500, unit: 'grapheme-composite' }),
          (input) => {
            const result = parseDockerfile(input);
            expect(result).toBeDefined();
            expect(result).toHaveProperty('baseImage');
            expect(result).toHaveProperty('exposedPorts');
            expect(Array.isArray(result.exposedPorts)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('parseDockerfile never throws for non-string inputs', () => {
      const nonStringInputs = [null, undefined, 0, 123, true, false, {}, [], NaN];
      for (const input of nonStringInputs) {
        const result = parseDockerfile(input);
        expect(result).toEqual({ baseImage: null, exposedPorts: [] });
      }
    });
  });
});
