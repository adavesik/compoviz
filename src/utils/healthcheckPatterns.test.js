import { describe, it, expect } from 'vitest';
import {
    normalizeTestCommand,
    getRecommendedHealthcheck,
    FAKE_PATTERNS,
} from './healthcheckPatterns';

describe('normalizeTestCommand', () => {
    describe('CMD-SHELL prefix', () => {
        it('returns the shell command string', () => {
            expect(normalizeTestCommand(['CMD-SHELL', 'curl -f http://localhost/']))
                .toBe('curl -f http://localhost/');
        });

        it('returns empty string when no command follows', () => {
            expect(normalizeTestCommand(['CMD-SHELL'])).toBe('');
        });
    });

    describe('CMD prefix', () => {
        it('joins remaining elements with spaces', () => {
            expect(normalizeTestCommand(['CMD', '/usr/bin/pg_isready', '-U', 'postgres']))
                .toBe('/usr/bin/pg_isready -U postgres');
        });

        it('returns empty string when no args follow', () => {
            expect(normalizeTestCommand(['CMD'])).toBe('');
        });
    });

    describe('NONE prefix', () => {
        it('returns empty string', () => {
            expect(normalizeTestCommand(['NONE'])).toBe('');
        });

        it('returns empty string even with extra elements', () => {
            expect(normalizeTestCommand(['NONE', 'ignored'])).toBe('');
        });
    });

    describe('no recognized prefix', () => {
        it('joins all elements with spaces', () => {
            expect(normalizeTestCommand(['curl', '-f', 'http://localhost/']))
                .toBe('curl -f http://localhost/');
        });

        it('handles single element', () => {
            expect(normalizeTestCommand(['true'])).toBe('true');
        });
    });

    describe('edge cases', () => {
        it('returns empty string for empty array', () => {
            expect(normalizeTestCommand([])).toBe('');
        });

        it('returns empty string for non-array input', () => {
            expect(normalizeTestCommand(null)).toBe('');
            expect(normalizeTestCommand(undefined)).toBe('');
            expect(normalizeTestCommand('string')).toBe('');
            expect(normalizeTestCommand(42)).toBe('');
        });
    });
});

describe('getRecommendedHealthcheck', () => {
    it('returns recommended command for postgres image', () => {
        const service = { image: 'postgres:15', runtime: {} };
        expect(getRecommendedHealthcheck(service))
            .toBe('pg_isready -U ${POSTGRES_USER:-postgres}');
    });

    it('returns recommended command for mysql image', () => {
        const service = { image: 'mysql:8', runtime: {} };
        expect(getRecommendedHealthcheck(service))
            .toBe('mysqladmin ping -h localhost');
    });

    it('returns recommended command for redis image', () => {
        const service = { image: 'redis:7-alpine', runtime: {} };
        expect(getRecommendedHealthcheck(service))
            .toBe('redis-cli ping');
    });

    it('returns recommended command for nginx image', () => {
        const service = { image: 'nginx:latest', runtime: {} };
        expect(getRecommendedHealthcheck(service))
            .toBe('curl -f http://localhost/ || exit 1');
    });

    it('returns recommended command for mongo image', () => {
        const service = { image: 'mongo:6', runtime: {} };
        expect(getRecommendedHealthcheck(service))
            .toBe('mongosh --eval "db.adminCommand(\'ping\')"');
    });

    it('returns recommended command for rabbitmq image', () => {
        const service = { image: 'rabbitmq:3-management', runtime: {} };
        expect(getRecommendedHealthcheck(service))
            .toBe('rabbitmq-diagnostics -q ping');
    });

    it('matches case-insensitively', () => {
        const service = { image: 'Postgres:15', runtime: {} };
        expect(getRecommendedHealthcheck(service))
            .toBe('pg_isready -U ${POSTGRES_USER:-postgres}');
    });

    it('returns null for unknown image', () => {
        const service = { image: 'myapp:latest', runtime: {} };
        expect(getRecommendedHealthcheck(service)).toBeNull();
    });

    it('returns null when service has no image', () => {
        const service = { runtime: {} };
        expect(getRecommendedHealthcheck(service)).toBeNull();
    });

    it('uses resolvedImage from runtime when image field is absent', () => {
        const service = { runtime: { resolvedImage: 'redis:7' } };
        expect(getRecommendedHealthcheck(service))
            .toBe('redis-cli ping');
    });
});

describe('FAKE_PATTERNS', () => {
    describe('should match fake/useless commands', () => {
        const fakeCommands = [
            'sleep 5',
            '  sleep 10',
            'exit 0',
            '  exit 0',
            'true',
            '  true  ',
            '/bin/true',
            '  /bin/true  ',
            'echo ok',
            '  echo hello',
        ];

        fakeCommands.forEach(cmd => {
            it(`matches "${cmd}"`, () => {
                const matched = FAKE_PATTERNS.some(pattern => pattern.test(cmd));
                expect(matched).toBe(true);
            });
        });
    });

    describe('should NOT match legitimate healthcheck commands', () => {
        const legitimateCommands = [
            'pg_isready',
            'curl -f http://localhost/',
            'redis-cli ping',
            'mysqladmin ping',
        ];

        legitimateCommands.forEach(cmd => {
            it(`does not match "${cmd}"`, () => {
                const matched = FAKE_PATTERNS.some(pattern => pattern.test(cmd));
                expect(matched).toBe(false);
            });
        });
    });
});
