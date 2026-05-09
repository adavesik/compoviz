import { describe, it, expect } from 'vitest';
import { parseDockerfile, extractFromInstructions, extractExposeInstructions } from './dockerfileParser';

describe('dockerfileParser', () => {
  describe('parseDockerfile', () => {
    it('parses single FROM with tag', () => {
      const content = 'FROM node:18-alpine\n';
      const result = parseDockerfile(content);
      expect(result.baseImage).toBe('node:18-alpine');
      expect(result.exposedPorts).toEqual([]);
    });

    it('parses FROM with no tag', () => {
      const content = 'FROM ubuntu\n';
      const result = parseDockerfile(content);
      expect(result.baseImage).toBe('ubuntu');
    });

    it('returns last FROM in multi-stage when no target specified', () => {
      const content = [
        'FROM node:18 AS builder',
        'RUN npm install',
        'FROM nginx:alpine AS runner',
        'COPY --from=builder /app /usr/share/nginx/html',
      ].join('\n');

      const result = parseDockerfile(content);
      expect(result.baseImage).toBe('nginx:alpine');
    });

    it('returns matching FROM when target is specified', () => {
      const content = [
        'FROM node:18 AS builder',
        'RUN npm install',
        'FROM nginx:alpine AS runner',
        'COPY --from=builder /app /usr/share/nginx/html',
      ].join('\n');

      const result = parseDockerfile(content, 'builder');
      expect(result.baseImage).toBe('node:18');
    });

    it('falls back to last FROM when target does not match any alias', () => {
      const content = [
        'FROM node:18 AS builder',
        'FROM nginx:alpine AS runner',
      ].join('\n');

      const result = parseDockerfile(content, 'nonexistent');
      expect(result.baseImage).toBe('nginx:alpine');
    });

    it('handles FROM with build arg variable', () => {
      const content = 'FROM ${BASE_IMAGE}\n';
      const result = parseDockerfile(content);
      expect(result.baseImage).toBe('${BASE_IMAGE}');
    });

    it('returns safe defaults for empty content', () => {
      const result = parseDockerfile('');
      expect(result.baseImage).toBeNull();
      expect(result.exposedPorts).toEqual([]);
    });

    it('returns safe defaults for null content', () => {
      const result = parseDockerfile(null);
      expect(result.baseImage).toBeNull();
      expect(result.exposedPorts).toEqual([]);
    });

    it('returns safe defaults for undefined content', () => {
      const result = parseDockerfile(undefined);
      expect(result.baseImage).toBeNull();
      expect(result.exposedPorts).toEqual([]);
    });

    it('ignores comment lines', () => {
      const content = [
        '# FROM fake:image',
        'FROM real:image',
      ].join('\n');

      const result = parseDockerfile(content);
      expect(result.baseImage).toBe('real:image');
    });

    it('ignores parser directives', () => {
      const content = [
        '# syntax=docker/dockerfile:1',
        'FROM node:18',
      ].join('\n');

      const result = parseDockerfile(content);
      expect(result.baseImage).toBe('node:18');
    });

    it('handles target matching case-insensitively', () => {
      const content = [
        'FROM node:18 AS Builder',
        'FROM nginx:alpine AS Runner',
      ].join('\n');

      const result = parseDockerfile(content, 'builder');
      expect(result.baseImage).toBe('node:18');
    });
  });

  describe('extractFromInstructions', () => {
    it('extracts single FROM instruction', () => {
      const content = 'FROM node:18-alpine\n';
      const result = extractFromInstructions(content);
      expect(result).toEqual([{ image: 'node:18-alpine', alias: null }]);
    });

    it('extracts FROM with AS alias', () => {
      const content = 'FROM node:18 AS builder\n';
      const result = extractFromInstructions(content);
      expect(result).toEqual([{ image: 'node:18', alias: 'builder' }]);
    });

    it('extracts multiple FROM instructions', () => {
      const content = [
        'FROM node:18 AS builder',
        'RUN npm install',
        'FROM nginx:alpine AS runner',
      ].join('\n');

      const result = extractFromInstructions(content);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ image: 'node:18', alias: 'builder' });
      expect(result[1]).toEqual({ image: 'nginx:alpine', alias: 'runner' });
    });

    it('skips commented FROM lines', () => {
      const content = [
        '# FROM commented:image',
        'FROM real:image',
      ].join('\n');

      const result = extractFromInstructions(content);
      expect(result).toHaveLength(1);
      expect(result[0].image).toBe('real:image');
    });

    it('returns empty array for empty content', () => {
      expect(extractFromInstructions('')).toEqual([]);
      expect(extractFromInstructions(null)).toEqual([]);
    });

    it('skips malformed FROM lines gracefully', () => {
      const content = [
        'FROM node:18',
        'FROMNOTVALID something',
        'FROM ',
        'FROM nginx:alpine',
      ].join('\n');

      const result = extractFromInstructions(content);
      // Only valid FROM lines are extracted
      expect(result).toHaveLength(2);
      expect(result[0].image).toBe('node:18');
      expect(result[1].image).toBe('nginx:alpine');
    });
  });

  describe('extractExposeInstructions', () => {
    it('extracts single EXPOSE port', () => {
      const content = 'EXPOSE 8080\n';
      const result = extractExposeInstructions(content);
      expect(result).toEqual([{ port: 8080, protocol: 'tcp' }]);
    });

    it('extracts multiple ports on one line', () => {
      const content = 'EXPOSE 8080 3000 9090\n';
      const result = extractExposeInstructions(content);
      expect(result).toEqual([
        { port: 8080, protocol: 'tcp' },
        { port: 3000, protocol: 'tcp' },
        { port: 9090, protocol: 'tcp' },
      ]);
    });

    it('extracts ports with protocol suffix', () => {
      const content = 'EXPOSE 8080/tcp 5000/udp\n';
      const result = extractExposeInstructions(content);
      expect(result).toEqual([
        { port: 8080, protocol: 'tcp' },
        { port: 5000, protocol: 'udp' },
      ]);
    });

    it('aggregates ports from multiple EXPOSE lines', () => {
      const content = [
        'EXPOSE 8080',
        'EXPOSE 3000/tcp',
        'EXPOSE 9090/udp',
      ].join('\n');

      const result = extractExposeInstructions(content);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ port: 8080, protocol: 'tcp' });
      expect(result[1]).toEqual({ port: 3000, protocol: 'tcp' });
      expect(result[2]).toEqual({ port: 9090, protocol: 'udp' });
    });

    it('skips non-numeric port values', () => {
      const content = 'EXPOSE 8080 $PORT 3000\n';
      const result = extractExposeInstructions(content);
      expect(result).toEqual([
        { port: 8080, protocol: 'tcp' },
        { port: 3000, protocol: 'tcp' },
      ]);
    });

    it('skips commented EXPOSE lines', () => {
      const content = [
        '# EXPOSE 9999',
        'EXPOSE 8080',
      ].join('\n');

      const result = extractExposeInstructions(content);
      expect(result).toHaveLength(1);
      expect(result[0].port).toBe(8080);
    });

    it('returns empty array for empty content', () => {
      expect(extractExposeInstructions('')).toEqual([]);
      expect(extractExposeInstructions(null)).toEqual([]);
    });

    it('handles EXPOSE with mixed valid and invalid entries', () => {
      const content = 'EXPOSE 8080 abc 3000/udp invalid/tcp\n';
      const result = extractExposeInstructions(content);
      expect(result).toEqual([
        { port: 8080, protocol: 'tcp' },
        { port: 3000, protocol: 'udp' },
      ]);
    });
  });
});
