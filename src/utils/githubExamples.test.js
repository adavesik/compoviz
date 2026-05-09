/* global global */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRemoteExamplesList, fetchRemoteExampleYaml, fetchRemoteExampleDescription, clearCache } from './githubExamples';

describe('githubExamples', () => {
    beforeEach(() => {
        clearCache();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchRemoteExamplesList', () => {
        it('fetches and parses directory listing from GitHub API', async () => {
            const mockResponse = [
                { name: 'nginx-golang-postgres', type: 'dir', html_url: 'https://github.com/docker/awesome-compose/tree/master/nginx-golang-postgres' },
                { name: 'react-express-mongodb', type: 'dir', html_url: 'https://github.com/docker/awesome-compose/tree/master/react-express-mongodb' },
                { name: '.github', type: 'dir', html_url: 'https://github.com/docker/awesome-compose/tree/master/.github' },
                { name: 'README.md', type: 'file', html_url: 'https://github.com/docker/awesome-compose/blob/master/README.md' },
            ];

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await fetchRemoteExamplesList();

            expect(result).toHaveLength(2); // Skips .github (hidden) and README.md (file)
            expect(result[0].id).toBe('nginx-golang-postgres');
            expect(result[0].name).toBe('Nginx + Go + PostgreSQL'); // From NAME_OVERRIDES
            expect(result[0].isRemote).toBe(true);
            expect(result[0].yaml).toBeNull();
            expect(result[1].id).toBe('react-express-mongodb');
        });

        it('skips known non-example directories', async () => {
            const mockResponse = [
                { name: 'official-documentation-samples', type: 'dir', html_url: 'https://...' },
                { name: 'nginx-flask-mysql', type: 'dir', html_url: 'https://...' },
            ];

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await fetchRemoteExamplesList();
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('nginx-flask-mysql');
        });

        it('caches results for subsequent calls', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve([
                    { name: 'test-example', type: 'dir', html_url: 'https://...' },
                ]),
            });

            await fetchRemoteExamplesList();
            await fetchRemoteExamplesList();

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('throws on API error', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
            });

            await expect(fetchRemoteExamplesList()).rejects.toThrow('GitHub API error: 403 Forbidden');
        });
    });

    describe('fetchRemoteExampleYaml', () => {
        it('fetches compose.yaml from raw.githubusercontent.com', async () => {
            const mockYaml = 'services:\n  web:\n    image: nginx';

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(mockYaml),
            });

            const result = await fetchRemoteExampleYaml('nginx-example');

            expect(result).toBe(mockYaml);
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('nginx-example/compose.yaml')
            );
        });

        it('tries fallback filenames if compose.yaml not found', async () => {
            const mockYaml = 'services:\n  api:\n    image: node';
            let callCount = 0;

            global.fetch = vi.fn().mockImplementation((url) => {
                callCount++;
                if (url.includes('compose.yaml')) {
                    return Promise.resolve({ ok: false });
                }
                if (url.includes('compose.yml')) {
                    return Promise.resolve({ ok: true, text: () => Promise.resolve(mockYaml) });
                }
                return Promise.resolve({ ok: false });
            });

            const result = await fetchRemoteExampleYaml('some-example');
            expect(result).toBe(mockYaml);
            expect(callCount).toBe(2); // Tried compose.yaml first, then compose.yml
        });

        it('throws if no compose file found', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: false });

            await expect(fetchRemoteExampleYaml('empty-dir')).rejects.toThrow(
                /No compose file found/
            );
        });
    });

    describe('clearCache', () => {
        it('forces re-fetch after clearing', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve([
                    { name: 'example', type: 'dir', html_url: 'https://...' },
                ]),
            });

            await fetchRemoteExamplesList();
            clearCache();
            await fetchRemoteExamplesList();

            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('fetchRemoteExampleDescription', () => {
        it('extracts description from README', async () => {
            const mockReadme = `# Nginx + Go + PostgreSQL

This is a sample project showing a three-tier web application.

## Getting Started
...`;

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(mockReadme),
            });

            const desc = await fetchRemoteExampleDescription('nginx-golang-postgres');
            expect(desc).toBe('This is a sample project showing a three-tier web application.');
        });

        it('returns null if README not found', async () => {
            global.fetch = vi.fn().mockResolvedValue({ ok: false });

            const desc = await fetchRemoteExampleDescription('nonexistent');
            expect(desc).toBeNull();
        });

        it('skips badge lines and extracts first paragraph', async () => {
            const mockReadme = `# Flask

![Build Status](https://img.shields.io/badge/build-passing-green)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://docker.com)

A simple Flask application running in a Docker container.

## Usage
...`;

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(mockReadme),
            });

            const desc = await fetchRemoteExampleDescription('flask');
            expect(desc).toBe('A simple Flask application running in a Docker container.');
        });
    });
});
