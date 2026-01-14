import { describe, it, expect } from 'vitest';
import { extractHostPort } from './comparison';

describe('extractHostPort - comprehensive edge cases', () => {
    describe('basic formats', () => {
        it('HOST:CONTAINER format', () => {
            expect(extractHostPort('8080:80')).toBe('0.0.0.0:8080');
            expect(extractHostPort('3000:3000')).toBe('0.0.0.0:3000');
        });

        it('container port only - should return null', () => {
            expect(extractHostPort('3000')).toBeNull();
            expect(extractHostPort('3000-3005')).toBeNull();
        });

        it('port ranges', () => {
            expect(extractHostPort('8000-9000:80')).toBe('0.0.0.0:8000-9000');
            expect(extractHostPort('9090-9091:8080-8081')).toBe('0.0.0.0:9090-9091');
        });
    });

    describe('IPv4 bind addresses', () => {
        it('standard IPv4 formats', () => {
            expect(extractHostPort('127.0.0.1:8080:80')).toBe('127.0.0.1:8080');
            expect(extractHostPort('10.22.60.110:80:80')).toBe('10.22.60.110:80');
            expect(extractHostPort('192.168.1.1:443:443')).toBe('192.168.1.1:443');
            expect(extractHostPort('0.0.0.0:8080:8080')).toBe('0.0.0.0:8080');
        });

        it('IPv4 with port ranges', () => {
            expect(extractHostPort('127.0.0.1:5000-5010:5000-5010')).toBe('127.0.0.1:5000-5010');
        });
    });

    describe('protocol suffixes', () => {
        it('removes /tcp suffix', () => {
            expect(extractHostPort('8080:80/tcp')).toBe('0.0.0.0:8080');
            expect(extractHostPort('127.0.0.1:3000:3000/tcp')).toBe('127.0.0.1:3000');
        });

        it('removes /udp suffix', () => {
            expect(extractHostPort('53:53/udp')).toBe('0.0.0.0:53');
            expect(extractHostPort('127.0.0.1:53:53/udp')).toBe('127.0.0.1:53');
        });

        it('removes /UDP suffix (case insensitive)', () => {
            expect(extractHostPort('53:53/UDP')).toBe('0.0.0.0:53');
        });
    });

    describe('IPv6 addresses', () => {
        it('IPv6 with square brackets', () => {
            expect(extractHostPort('[::1]:8080:80')).toBe('[::1]:8080');
            expect(extractHostPort('[::1]:3000:3000')).toBe('[::1]:3000');
            expect(extractHostPort('[2001:db8::1]:443:443')).toBe('[2001:db8::1]:443');
            expect(extractHostPort('[fe80::1]:3000:3000')).toBe('[fe80::1]:3000');
        });

        it('IPv6 with protocol suffix', () => {
            expect(extractHostPort('[::1]:53:53/udp')).toBe('[::1]:53');
            expect(extractHostPort('[::1]:8080:80/tcp')).toBe('[::1]:8080');
        });

        it('IPv6 without brackets - ambiguous, returns null', () => {
            expect(extractHostPort('::1:8080:80')).toBeNull();
            expect(extractHostPort('2001:db8::1:443:443')).toBeNull();
        });

        it('malformed IPv6 with missing bracket', () => {
            expect(extractHostPort('[::1:8080:80')).toBeNull();
        });
    });

    describe('edge cases and invalid inputs', () => {
        it('null and undefined', () => {
            expect(extractHostPort(null)).toBeNull();
            expect(extractHostPort(undefined)).toBeNull();
            expect(extractHostPort('')).toBeNull();
        });

        it('non-string inputs', () => {
            expect(extractHostPort(123)).toBeNull();
            expect(extractHostPort({})).toBeNull();
            expect(extractHostPort([])).toBeNull();
        });

        it('malformed port strings', () => {
            expect(extractHostPort(':')).toBeNull();
            expect(extractHostPort('::')).toBeNull();
        });
    });
});
