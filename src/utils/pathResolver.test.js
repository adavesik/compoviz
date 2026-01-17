import { describe, it, expect } from 'vitest';
import {
    normalizePath,
    dirname,
    joinPath,
    resolvePath,
    createFileMap,
    getRelativePath
} from './pathResolver';

describe('pathResolver', () => {
    describe('normalizePath', () => {
        it('removes . segments', () => {
            expect(normalizePath('foo/./bar')).toBe('foo/bar');
            expect(normalizePath('./foo/bar')).toBe('foo/bar');
        });

        it('resolves .. segments', () => {
            expect(normalizePath('foo/bar/../baz')).toBe('foo/baz');
            expect(normalizePath('foo/../bar')).toBe('bar');
        });

        it('handles complex paths', () => {
            expect(normalizePath('a/b/../../c/./d')).toBe('c/d');
            expect(normalizePath('./foo/../bar/./baz')).toBe('bar/baz');
        });

        it('handles edge cases', () => {
            expect(normalizePath('')).toBe('');
            expect(normalizePath('foo')).toBe('foo');
            expect(normalizePath('/')).toBe('');
        });
    });

    describe('dirname', () => {
        it('returns directory portion of path', () => {
            expect(dirname('foo/bar/baz.yml')).toBe('foo/bar');
            expect(dirname('foo/bar.yml')).toBe('foo');
        });

        it('handles paths without directory', () => {
            expect(dirname('file.yml')).toBe('');
            expect(dirname('')).toBe('');
        });

        it('handles paths with .. segments', () => {
            expect(dirname('foo/../bar/baz.yml')).toBe('bar');
        });
    });

    describe('joinPath', () => {
        it('joins simple paths', () => {
            expect(joinPath('foo', 'bar')).toBe('foo/bar');
            expect(joinPath('foo/bar', 'baz')).toBe('foo/bar/baz');
        });

        it('handles ./ prefix in relative path', () => {
            expect(joinPath('foo', './bar')).toBe('foo/bar');
        });

        it('handles .. in relative path', () => {
            expect(joinPath('foo/bar', '../baz')).toBe('foo/baz');
            expect(joinPath('foo/bar/baz', '../../qux')).toBe('foo/qux');
        });

        it('handles empty paths', () => {
            expect(joinPath('', 'foo')).toBe('foo');
            expect(joinPath('foo', '')).toBe('foo');
        });
    });

    describe('resolvePath', () => {
        it('resolves relative paths from current file', () => {
            expect(resolvePath('project/frontend/compose.yml', './base.yml'))
                .toBe('project/frontend/base.yml');
        });

        it('resolves complex relative paths', () => {
            expect(resolvePath('project/services/frontend/compose.yml', '../../../backend/api.yml'))
                .toBe('backend/api.yml');
        });

        it('resolves paths with . and ..', () => {
            expect(resolvePath('project/compose.yml', './database/docker-compose.yml'))
                .toBe('project/database/docker-compose.yml');
        });
    });

    describe('createFileMap', () => {
        it('uses webkitRelativePath when available', () => {
            const files = [
                { name: 'compose.yml', webkitRelativePath: 'project/compose.yml', content: 'a' },
                { name: 'base.yml', webkitRelativePath: 'project/base.yml', content: 'b' }
            ];

            const { fileMap, collisions } = createFileMap(files);

            expect(fileMap['project/compose.yml']).toBe('a');
            expect(fileMap['project/base.yml']).toBe('b');
            expect(collisions).toHaveLength(0);
        });

        it('falls back to name when webkitRelativePath is empty', () => {
            const files = [
                { name: 'compose.yml', webkitRelativePath: '', content: 'a' }
            ];

            const { fileMap, collisions } = createFileMap(files);

            expect(fileMap['compose.yml']).toBe('a');
            expect(collisions).toHaveLength(0);
        });

        it('detects and handles name collisions', () => {
            const files = [
                { name: 'docker-compose.yml', webkitRelativePath: '', content: 'frontend' },
                { name: 'docker-compose.yml', webkitRelativePath: '', content: 'backend' }
            ];

            const { fileMap, collisions } = createFileMap(files);

            expect(fileMap['docker-compose.yml']).toBe('frontend');
            expect(fileMap['upload-1/docker-compose.yml']).toBe('backend');
            expect(collisions).toHaveLength(1);
            expect(collisions[0]).toContain('collision detected');
        });

        it('handles multiple collisions', () => {
            const files = [
                { name: 'compose.yml', webkitRelativePath: '', content: '1' },
                { name: 'compose.yml', webkitRelativePath: '', content: '2' },
                { name: 'compose.yml', webkitRelativePath: '', content: '3' }
            ];

            const { fileMap, collisions } = createFileMap(files);

            expect(fileMap['compose.yml']).toBe('1');
            expect(fileMap['upload-1/compose.yml']).toBe('2');
            expect(fileMap['upload-2/compose.yml']).toBe('3');
            expect(collisions).toHaveLength(2);
        });

        it('normalizes all paths', () => {
            const files = [
                { name: 'compose.yml', webkitRelativePath: './project/./foo/../compose.yml', content: 'a' }
            ];

            const { fileMap } = createFileMap(files);

            expect(fileMap['project/compose.yml']).toBe('a');
        });
    });

    describe('getRelativePath', () => {
        it('calculates relative path between files', () => {
            expect(getRelativePath('project/frontend/compose.yml', 'project/backend/api.yml'))
                .toBe('../backend/api.yml');
        });

        it('handles files in same directory', () => {
            expect(getRelativePath('project/compose.yml', 'project/base.yml'))
                .toBe('base.yml');
        });

        it('handles deeply nested paths', () => {
            // From a/b/c/d.yml to a/x/y/z.yml
            // Up 2 levels from c to a, then into x/y/z.yml
            expect(getRelativePath('a/b/c/d.yml', 'a/x/y/z.yml'))
                .toBe('../../x/y/z.yml');
        });

        it('handles paths with no common prefix', () => {
            // From foo/bar.yml to baz/qux.yml
            // Up 1 level from foo, then into baz/qux.yml
            expect(getRelativePath('foo/bar.yml', 'baz/qux.yml'))
                .toBe('../baz/qux.yml');
        });
    });
});
