import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichComposeState } from './dockerfileEnricher';

vi.mock('./dockerfileFetcher.js', () => ({
  fetchDockerfile: vi.fn(),
}));

vi.mock('./dockerfileParser.js', () => ({
  parseDockerfile: vi.fn(),
}));

import { fetchDockerfile } from './dockerfileFetcher.js';
import { parseDockerfile } from './dockerfileParser.js';

describe('dockerfileEnricher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enrichComposeState', () => {
    it('sets _resolvedImage when service has build + no image', async () => {
      fetchDockerfile.mockResolvedValue('FROM node:18-alpine\n');
      parseDockerfile.mockReturnValue({
        baseImage: 'node:18-alpine',
        exposedPorts: [],
      });

      const state = {
        services: {
          web: { build: './frontend' },
        },
      };

      const result = await enrichComposeState(state);

      expect(result.services.web._resolvedImage).toBe('node:18-alpine');
      expect(fetchDockerfile).toHaveBeenCalledWith('./frontend', 'Dockerfile', expect.any(Object));
      expect(parseDockerfile).toHaveBeenCalledWith('FROM node:18-alpine\n', null);
    });

    it('does NOT set _resolvedImage when service has explicit image', async () => {
      const state = {
        services: {
          web: { build: './frontend', image: 'myapp:latest' },
        },
      };

      const result = await enrichComposeState(state);

      expect(result.services.web._resolvedImage).toBeUndefined();
      expect(fetchDockerfile).not.toHaveBeenCalled();
    });

    it('sets _resolvedPorts when EXPOSE found and no explicit ports', async () => {
      fetchDockerfile.mockResolvedValue('FROM node:18\nEXPOSE 3000 8080\n');
      parseDockerfile.mockReturnValue({
        baseImage: 'node:18',
        exposedPorts: [
          { port: 3000, protocol: 'tcp' },
          { port: 8080, protocol: 'tcp' },
        ],
      });

      const state = {
        services: {
          api: { build: './backend' },
        },
      };

      const result = await enrichComposeState(state);

      expect(result.services.api._resolvedPorts).toEqual([
        { port: 3000, protocol: 'tcp' },
        { port: 8080, protocol: 'tcp' },
      ]);
    });

    it('does NOT set _resolvedPorts when service has explicit ports', async () => {
      fetchDockerfile.mockResolvedValue('FROM node:18\nEXPOSE 3000\n');
      parseDockerfile.mockReturnValue({
        baseImage: 'node:18',
        exposedPorts: [{ port: 3000, protocol: 'tcp' }],
      });

      const state = {
        services: {
          api: { build: './backend', ports: ['3000:3000'] },
        },
      };

      const result = await enrichComposeState(state);

      expect(result.services.api._resolvedPorts).toBeUndefined();
      expect(result.services.api._resolvedImage).toBe('node:18');
    });

    it('leaves service unchanged when fetch returns null', async () => {
      fetchDockerfile.mockResolvedValue(null);

      const state = {
        services: {
          api: { build: './backend', environment: { NODE_ENV: 'production' } },
        },
      };

      const result = await enrichComposeState(state);

      expect(result.services.api._resolvedImage).toBeUndefined();
      expect(result.services.api._resolvedPorts).toBeUndefined();
      expect(result.services.api.environment).toEqual({ NODE_ENV: 'production' });
    });

    it('handles multiple services with partial failure', async () => {
      fetchDockerfile
        .mockResolvedValueOnce('FROM node:18\n')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('FROM python:3.11\n');

      parseDockerfile
        .mockReturnValueOnce({ baseImage: 'node:18', exposedPorts: [] })
        .mockReturnValueOnce({ baseImage: 'python:3.11', exposedPorts: [] });

      const state = {
        services: {
          frontend: { build: './frontend' },
          backend: { build: './backend' },
          worker: { build: './worker' },
        },
      };

      const result = await enrichComposeState(state);

      expect(result.services.frontend._resolvedImage).toBe('node:18');
      expect(result.services.backend._resolvedImage).toBeUndefined();
      expect(result.services.worker._resolvedImage).toBe('python:3.11');
    });

    it('resolves shorthand build string correctly', async () => {
      fetchDockerfile.mockResolvedValue('FROM golang:1.21\n');
      parseDockerfile.mockReturnValue({
        baseImage: 'golang:1.21',
        exposedPorts: [],
      });

      const state = {
        services: {
          api: { build: './backend' },
        },
      };

      await enrichComposeState(state);

      expect(fetchDockerfile).toHaveBeenCalledWith('./backend', 'Dockerfile', expect.any(Object));
    });

    it('resolves build object with context and dockerfile', async () => {
      fetchDockerfile.mockResolvedValue('FROM node:20\n');
      parseDockerfile.mockReturnValue({
        baseImage: 'node:20',
        exposedPorts: [],
      });

      const state = {
        services: {
          web: {
            build: {
              context: './frontend',
              dockerfile: 'Dockerfile.prod',
              target: 'production',
            },
          },
        },
      };

      await enrichComposeState(state);

      expect(fetchDockerfile).toHaveBeenCalledWith(
        './frontend',
        'Dockerfile.prod',
        expect.any(Object)
      );
      expect(parseDockerfile).toHaveBeenCalledWith('FROM node:20\n', 'production');
    });

    it('handles timeout by leaving service unchanged', async () => {
      // Simulate a slow fetch that takes longer than the timeout
      fetchDockerfile.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('FROM slow:1.0\n'), 200))
      );

      const state = {
        services: {
          slow: { build: './slow-service' },
        },
      };

      // Use a very short timeout
      const result = await enrichComposeState(state, { timeout: 50 });

      // Service should remain unchanged because timeout fires first
      expect(result.services.slow._resolvedImage).toBeUndefined();
    });

    it('skips services with no build directive', async () => {
      const state = {
        services: {
          db: { image: 'postgres:15' },
          cache: { image: 'redis:7' },
        },
      };

      const result = await enrichComposeState(state);

      expect(fetchDockerfile).not.toHaveBeenCalled();
      expect(result.services.db._resolvedImage).toBeUndefined();
      expect(result.services.cache._resolvedImage).toBeUndefined();
    });

    it('returns state unchanged when state has no services', async () => {
      const state = { services: {} };
      const result = await enrichComposeState(state);
      expect(result).toBe(state);
    });

    it('returns state unchanged when state is null or invalid', async () => {
      const result1 = await enrichComposeState(null);
      expect(result1).toBeNull();

      const result2 = await enrichComposeState({});
      expect(result2).toEqual({});
    });
  });
});
