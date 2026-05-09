/* global global */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDockerfile, clearDockerfileCache } from './dockerfileFetcher';

describe('dockerfileFetcher', () => {
  beforeEach(() => {
    clearDockerfileCache();
    vi.restoreAllMocks();
  });

  describe('fetchDockerfile - remote fetch', () => {
    it('returns content on successful remote fetch', async () => {
      const dockerfileContent = 'FROM node:18-alpine\nEXPOSE 3000\n';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(dockerfileContent),
      });

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        exampleDir: 'nginx-flask-mysql',
      });

      expect(result).toBe(dockerfileContent);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/docker/awesome-compose/master/nginx-flask-mysql/backend/Dockerfile',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('returns null on 404 response without throwing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        exampleDir: 'nginx-flask-mysql',
      });

      expect(result).toBeNull();
    });

    it('returns null on network error without throwing', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        exampleDir: 'nginx-flask-mysql',
      });

      expect(result).toBeNull();
    });

    it('returns null on timeout without throwing', async () => {
      // Simulate an abort error (what happens when AbortController fires)
      global.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        exampleDir: 'nginx-flask-mysql',
        timeout: 100,
      });

      expect(result).toBeNull();
    });

    it('uses default dockerfileName "Dockerfile"', async () => {
      const dockerfileContent = 'FROM python:3.11\n';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(dockerfileContent),
      });

      const result = await fetchDockerfile('./api', undefined, {
        exampleDir: 'flask-redis',
      });

      expect(result).toBe(dockerfileContent);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/docker/awesome-compose/master/flask-redis/api/Dockerfile',
        expect.any(Object)
      );
    });

    it('uses custom dockerfileName when specified', async () => {
      const dockerfileContent = 'FROM node:20\n';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(dockerfileContent),
      });

      const result = await fetchDockerfile('./frontend', 'Dockerfile.prod', {
        exampleDir: 'react-express-mongodb',
      });

      expect(result).toBe(dockerfileContent);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/docker/awesome-compose/master/react-express-mongodb/frontend/Dockerfile.prod',
        expect.any(Object)
      );
    });
  });

  describe('fetchDockerfile - local fileMap', () => {
    it('returns content from fileMap without making network calls', async () => {
      global.fetch = vi.fn();
      const fileMap = {
        'backend/Dockerfile': 'FROM golang:1.21\nEXPOSE 8080\n',
      };

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        fileMap,
      });

      expect(result).toBe('FROM golang:1.21\nEXPOSE 8080\n');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('resolves fileMap with project prefix', async () => {
      global.fetch = vi.fn();
      const fileMap = {
        'myproject/backend/Dockerfile': 'FROM rust:1.70\n',
      };

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        fileMap,
        exampleDir: 'myproject',
      });

      expect(result).toBe('FROM rust:1.70\n');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('resolves fileMap with ./ prefix', async () => {
      global.fetch = vi.fn();
      const fileMap = {
        './backend/Dockerfile': 'FROM php:8.2\n',
      };

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        fileMap,
      });

      expect(result).toBe('FROM php:8.2\n');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null when fileMap does not contain the Dockerfile', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      const fileMap = {
        'frontend/Dockerfile': 'FROM node:18\n',
      };

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        fileMap,
        exampleDir: 'test-project',
      });

      expect(result).toBeNull();
    });
  });

  describe('fetchDockerfile - caching', () => {
    it('returns cached content on second call without fetching again', async () => {
      const dockerfileContent = 'FROM node:18\n';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(dockerfileContent),
      });

      const result1 = await fetchDockerfile('./backend', 'Dockerfile', {
        exampleDir: 'test-project',
      });
      const result2 = await fetchDockerfile('./backend', 'Dockerfile', {
        exampleDir: 'test-project',
      });

      expect(result1).toBe(dockerfileContent);
      expect(result2).toBe(dockerfileContent);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('caches null results (negative caching)', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

      const result1 = await fetchDockerfile('./missing', 'Dockerfile', {
        exampleDir: 'test-project',
      });
      const result2 = await fetchDockerfile('./missing', 'Dockerfile', {
        exampleDir: 'test-project',
      });

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchDockerfile - path resolution', () => {
    it('resolves shorthand build string path (strips ./)', async () => {
      const dockerfileContent = 'FROM python:3.11\n';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(dockerfileContent),
      });

      const result = await fetchDockerfile('./backend', 'Dockerfile', {
        exampleDir: 'flask-redis',
      });

      expect(result).toBe(dockerfileContent);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/docker/awesome-compose/master/flask-redis/backend/Dockerfile',
        expect.any(Object)
      );
    });

    it('handles context path without ./ prefix', async () => {
      const dockerfileContent = 'FROM nginx:alpine\n';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(dockerfileContent),
      });

      const result = await fetchDockerfile('frontend', 'Dockerfile', {
        exampleDir: 'react-nginx',
      });

      expect(result).toBe(dockerfileContent);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/docker/awesome-compose/master/react-nginx/frontend/Dockerfile',
        expect.any(Object)
      );
    });

    it('returns null when no exampleDir and no fileMap match', async () => {
      global.fetch = vi.fn();

      const result = await fetchDockerfile('./backend', 'Dockerfile', {});

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('clearDockerfileCache', () => {
    it('clears the cache so subsequent calls fetch again', async () => {
      const dockerfileContent = 'FROM node:18\n';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(dockerfileContent),
      });

      await fetchDockerfile('./backend', 'Dockerfile', { exampleDir: 'test' });
      clearDockerfileCache();
      await fetchDockerfile('./backend', 'Dockerfile', { exampleDir: 'test' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
