import { describe, it, expect } from 'vitest';
import {
    parseEnvFile,
    mergeEnv,
    interpolate,
    extractVariables,
    getUndefinedVariables
} from './variableInterpolator';

describe('variableInterpolator', () => {
    describe('parseEnvFile', () => {
        it('parses simple env file', () => {
            const content = 'PORT=3000\nHOST=localhost';
            const result = parseEnvFile(content);

            expect(result).toEqual({
                PORT: '3000',
                HOST: 'localhost'
            });
        });

        it('handles inline comments', () => {
            const content = 'PORT=3000 # Web server port';
            const result = parseEnvFile(content);

            expect(result.PORT).toBe('3000');
        });

        it('handles quoted values', () => {
            const content = 'MESSAGE="has # hash"';
            const result = parseEnvFile(content);

            expect(result.MESSAGE).toBe('has # hash');
        });

        it('handles empty content', () => {
            expect(parseEnvFile('')).toEqual({});
            expect(parseEnvFile(null)).toEqual({});
        });
    });

    describe('mergeEnv', () => {
        it('merges multiple environment objects', () => {
            const env1 = { A: '1', B: '2' };
            const env2 = { B: '3', C: '4' };
            const env3 = { C: '5', D: '6' };

            const result = mergeEnv(env1, env2, env3);

            expect(result).toEqual({
                A: '1',
                B: '3', // Overridden by env2
                C: '5', // Overridden by env3
                D: '6'
            });
        });
    });

    describe('interpolate', () => {
        it('interpolates simple variables', () => {
            const env = { PORT: '3000', HOST: 'localhost' };

            expect(interpolate('${PORT}', env, false)).toBe('3000');
            expect(interpolate('http://${HOST}:${PORT}', env, false)).toBe('http://localhost:3000');
        });

        it('handles default values with :-', () => {
            const env = { PORT: '3000' };

            expect(interpolate('${PORT:-8080}', env, false)).toBe('3000');
            expect(interpolate('${MISSING:-8080}', env, false)).toBe('8080');
            expect(interpolate('${EMPTY:-default}', { EMPTY: '' }, false)).toBe('default');
        });

        it('handles default values with -', () => {
            const env = { PORT: '3000' };

            expect(interpolate('${PORT-8080}', env, false)).toBe('3000');
            expect(interpolate('${MISSING-8080}', env, false)).toBe('8080');
            // Note: - doesn't treat empty as unset
            expect(interpolate('${EMPTY-default}', { EMPTY: '' }, false)).toBe('');
        });

        it('handles required variables with :?', () => {
            const env = { PORT: '3000' };

            expect(() => interpolate('${MISSING:?required}', env, false))
                .toThrow(/required/i);
            expect(() => interpolate('${EMPTY:?required}', { EMPTY: '' }, false))
                .toThrow(/required/i);
        });

        it('escapes dollar signs ($$)', () => {
            const env = {};

            expect(interpolate('$$VAR', env, false)).toBe('$VAR');
            expect(interpolate('$$${PORT}', { PORT: '3000' }, false)).toBe('$3000');
        });

        it('interpolates arrays', () => {
            const env = { PORT: '3000' };
            const value = ['${PORT}:80', '443:443'];

            const result = interpolate(value, env, false);

            expect(result).toEqual(['3000:80', '443:443']);
        });

        it('interpolates objects', () => {
            const env = { NODE_ENV: 'production', PORT: '3000' };
            const value = {
                environment: {
                    NODE_ENV: '${NODE_ENV}',
                    PORT: '${PORT}'
                }
            };

            const result = interpolate(value, env, false);

            expect(result.environment).toEqual({
                NODE_ENV: 'production',
                PORT: '3000'
            });
        });

        it('adds metadata when addMetadata=true', () => {
            const env = { PORT: '3000' };
            const result = interpolate('${PORT}:80', env, true);

            expect(result).toEqual({
                _value: '3000:80',
                _original: '${PORT}:80',
                _hasVariable: true,
                _variables: ['PORT']
            });
        });

        it('does not add metadata for strings without variables', () => {
            const env = {};
            const result = interpolate('plain text', env, true);

            expect(result).toBe('plain text');
        });

        it('handles nested variables in complex objects', () => {
            const env = {
                HOST: 'localhost',
                PORT: '3000',
                PATH: '/api'
            };

            const compose = {
                services: {
                    web: {
                        environment: {
                            URL: 'http://${HOST}:${PORT}${PATH}'
                        },
                        ports: ['${PORT}:80']
                    }
                }
            };

            const result = interpolate(compose, env, false);

            expect(result.services.web.environment.URL).toBe('http://localhost:3000/api');
            expect(result.services.web.ports).toEqual(['3000:80']);
        });

        it('preserves non-string values', () => {
            const env = {};

            expect(interpolate(null, env)).toBe(null);
            expect(interpolate(undefined, env)).toBe(undefined);
            expect(interpolate(123, env)).toBe(123);
            expect(interpolate(true, env)).toBe(true);
        });
    });

    describe('extractVariables', () => {
        it('extracts all variable references', () => {
            const compose = {
                services: {
                    web: {
                        environment: {
                            PORT: '${PORT:-3000}',
                            HOST: '${HOST}'
                        },
                        image: 'nginx:${VERSION}'
                    }
                }
            };

            const vars = extractVariables(compose);

            expect(vars.has('PORT')).toBe(true);
            expect(vars.has('HOST')).toBe(true);
            expect(vars.has('VERSION')).toBe(true);
            expect(vars.size).toBe(3);
        });

        it('handles duplicate references', () => {
            const compose = {
                a: '${VAR}',
                b: '${VAR}',
                c: '${VAR:-default}'
            };

            const vars = extractVariables(compose);

            expect(vars.size).toBe(1);
            expect(vars.has('VAR')).toBe(true);
        });

        it('extracts from arrays', () => {
            const compose = {
                ports: ['${PORT1}:80', '${PORT2}:443']
            };

            const vars = extractVariables(compose);

            expect(vars.has('PORT1')).toBe(true);
            expect(vars.has('PORT2')).toBe(true);
        });
    });

    describe('getUndefinedVariables', () => {
        it('returns undefined variables', () => {
            const compose = {
                environment: {
                    A: '${VAR_A}',
                    B: '${VAR_B}',
                    C: '${VAR_C}'
                }
            };
            const env = {
                VAR_A: 'value',
                VAR_B: 'value'
            };

            const undefinedVars = getUndefinedVariables(compose, env);

            expect(undefinedVars).toEqual(['VAR_C']);
        });

        it('returns empty array when all defined', () => {
            const compose = {
                environment: {
                    A: '${VAR_A}'
                }
            };
            const env = { VAR_A: 'value' };

            expect(getUndefinedVariables(compose, env)).toEqual([]);
        });
    });
});
