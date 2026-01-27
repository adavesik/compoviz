import { describe, it, expect } from 'vitest';
import { deepEqual, mergeFlowElements } from './objectUtils';

describe('deepEqual', () => {
    describe('primitives', () => {
        it('should return true for identical numbers', () => {
            expect(deepEqual(42, 42)).toBe(true);
            expect(deepEqual(0, 0)).toBe(true);
            expect(deepEqual(-1, -1)).toBe(true);
        });

        it('should return false for different numbers', () => {
            expect(deepEqual(42, 43)).toBe(false);
            expect(deepEqual(0, 1)).toBe(false);
        });

        it('should return true for identical strings', () => {
            expect(deepEqual('hello', 'hello')).toBe(true);
            expect(deepEqual('', '')).toBe(true);
        });

        it('should return false for different strings', () => {
            expect(deepEqual('hello', 'world')).toBe(false);
        });

        it('should return true for identical booleans', () => {
            expect(deepEqual(true, true)).toBe(true);
            expect(deepEqual(false, false)).toBe(true);
        });

        it('should return false for different booleans', () => {
            expect(deepEqual(true, false)).toBe(false);
        });

        it('should handle null correctly', () => {
            expect(deepEqual(null, null)).toBe(true);
            expect(deepEqual(null, undefined)).toBe(false);
            expect(deepEqual(null, 0)).toBe(false);
        });

        it('should handle undefined correctly', () => {
            expect(deepEqual(undefined, undefined)).toBe(true);
            expect(deepEqual(undefined, null)).toBe(false);
        });

        it('should handle NaN correctly', () => {
            expect(deepEqual(NaN, NaN)).toBe(true);
            expect(deepEqual(NaN, 0)).toBe(false);
        });
    });

    describe('objects', () => {
        it('should return true for identical simple objects', () => {
            const obj = { a: 1, b: 2 };
            expect(deepEqual(obj, obj)).toBe(true);
        });

        it('should return true for equal simple objects', () => {
            expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
        });

        it('should return true for objects with different key order', () => {
            expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
        });

        it('should return false for objects with different values', () => {
            expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
        });

        it('should return false for objects with different keys', () => {
            expect(deepEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
        });

        it('should return false for objects with different number of keys', () => {
            expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        });

        it('should return true for empty objects', () => {
            expect(deepEqual({}, {})).toBe(true);
        });

        it('should handle nested objects', () => {
            const obj1 = { a: { b: { c: 1 } } };
            const obj2 = { a: { b: { c: 1 } } };
            const obj3 = { a: { b: { c: 2 } } };

            expect(deepEqual(obj1, obj2)).toBe(true);
            expect(deepEqual(obj1, obj3)).toBe(false);
        });
    });

    describe('arrays', () => {
        it('should return true for identical arrays', () => {
            const arr = [1, 2, 3];
            expect(deepEqual(arr, arr)).toBe(true);
        });

        it('should return true for equal simple arrays', () => {
            expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        });

        it('should return false for arrays with different values', () => {
            expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
        });

        it('should return false for arrays with different lengths', () => {
            expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
        });

        it('should return false for arrays with different order', () => {
            expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
        });

        it('should return true for empty arrays', () => {
            expect(deepEqual([], [])).toBe(true);
        });

        it('should handle nested arrays', () => {
            expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true);
            expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]])).toBe(false);
        });
    });

    describe('mixed types', () => {
        it('should return false for different types', () => {
            expect(deepEqual(42, '42')).toBe(false);
            expect(deepEqual([], {})).toBe(false);
            expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
            expect(deepEqual(null, {})).toBe(false);
            expect(deepEqual(undefined, {})).toBe(false);
        });

        it('should handle complex nested structures', () => {
            const obj1 = {
                name: 'service1',
                ports: [8080, 8081],
                config: { host: 'localhost', ssl: true },
                tags: ['web', 'api']
            };
            const obj2 = {
                name: 'service1',
                ports: [8080, 8081],
                config: { host: 'localhost', ssl: true },
                tags: ['web', 'api']
            };
            const obj3 = {
                name: 'service1',
                ports: [8080, 8081],
                config: { host: 'localhost', ssl: false }, // Different
                tags: ['web', 'api']
            };

            expect(deepEqual(obj1, obj2)).toBe(true);
            expect(deepEqual(obj1, obj3)).toBe(false);
        });
    });
});

describe('mergeFlowElements', () => {
    describe('reference preservation', () => {
        it('should preserve references for unchanged elements', () => {
            const prevElements = [
                { id: 'node-1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
                { id: 'node-2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } }
            ];
            const newElements = [
                { id: 'node-1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
                { id: 'node-2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } }
            ];

            const result = mergeFlowElements(prevElements, newElements);

            // Should preserve exact references
            expect(result[0]).toBe(prevElements[0]);
            expect(result[1]).toBe(prevElements[1]);
        });

        it('should return prevElements reference if no changes detected', () => {
            const prevElements = [
                { id: 'node-1', data: { label: 'Node 1' } },
                { id: 'node-2', data: { label: 'Node 2' } }
            ];
            const newElements = [
                { id: 'node-1', data: { label: 'Node 1' } },
                { id: 'node-2', data: { label: 'Node 2' } }
            ];

            const result = mergeFlowElements(prevElements, newElements);

            // Should return the exact same array reference
            expect(result).toBe(prevElements);
        });

        it('should return prevElements if arrays are identical reference', () => {
            const elements = [
                { id: 'node-1', data: { label: 'Node 1' } }
            ];

            const result = mergeFlowElements(elements, elements);
            expect(result).toBe(elements);
        });
    });

    describe('update detection', () => {
        it('should detect changes in element data', () => {
            const prevElements = [
                { id: 'node-1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
                { id: 'node-2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } }
            ];
            const newElements = [
                { id: 'node-1', data: { label: 'Node 1 Updated' }, position: { x: 0, y: 0 } }, // Changed
                { id: 'node-2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } }
            ];

            const result = mergeFlowElements(prevElements, newElements);

            // First element should be new reference (changed)
            expect(result[0]).toBe(newElements[0]);
            expect(result[0]).not.toBe(prevElements[0]);

            // Second element should preserve reference (unchanged)
            expect(result[1]).toBe(prevElements[1]);

            // Result should be a new array (not prevElements)
            expect(result).not.toBe(prevElements);
        });

        it('should detect changes in position', () => {
            const prevElements = [
                { id: 'node-1', position: { x: 0, y: 0 } }
            ];
            const newElements = [
                { id: 'node-1', position: { x: 50, y: 50 } } // Moved
            ];

            const result = mergeFlowElements(prevElements, newElements);

            expect(result[0]).toBe(newElements[0]);
            expect(result).not.toBe(prevElements);
        });
    });

    describe('element additions and deletions', () => {
        it('should return new array when elements are added', () => {
            const prevElements = [
                { id: 'node-1', data: { label: 'Node 1' } }
            ];
            const newElements = [
                { id: 'node-1', data: { label: 'Node 1' } },
                { id: 'node-2', data: { label: 'Node 2' } } // Added
            ];

            const result = mergeFlowElements(prevElements, newElements);

            // Should return newElements because length changed
            expect(result).toBe(newElements);
        });

        it('should return new array when elements are removed', () => {
            const prevElements = [
                { id: 'node-1', data: { label: 'Node 1' } },
                { id: 'node-2', data: { label: 'Node 2' } }
            ];
            const newElements = [
                { id: 'node-1', data: { label: 'Node 1' } }
            ];

            const result = mergeFlowElements(prevElements, newElements);

            // Should return newElements because length changed
            expect(result).toBe(newElements);
        });
    });

    describe('element reordering (critical test)', () => {
        it('should handle reordering correctly with ID-based matching', () => {
            const prevElements = [
                { id: 'node-1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
                { id: 'node-2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
                { id: 'node-3', data: { label: 'Node 3' }, position: { x: 200, y: 0 } }
            ];
            const newElements = [
                { id: 'node-3', data: { label: 'Node 3' }, position: { x: 200, y: 0 } }, // Reordered
                { id: 'node-1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },   // Reordered
                { id: 'node-2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } }
            ];

            const result = mergeFlowElements(prevElements, newElements);

            // Should preserve references despite reordering
            // The result follows newElements order, but uses prevElements references
            // result[0] is node-3 (matches newElements[0].id)
            expect(result[0].id).toBe('node-3');
            expect(result[0]).toBe(prevElements[2]); // But it's the same object reference from prevElements

            // result[1] is node-1 (matches newElements[1].id)
            expect(result[1].id).toBe('node-1');
            expect(result[1]).toBe(prevElements[0]); // Same object reference from prevElements

            // result[2] is node-2 (matches newElements[2].id)
            expect(result[2].id).toBe('node-2');
            expect(result[2]).toBe(prevElements[1]); // Same object reference from prevElements

            // Should return a NEW array (not prevElements) because order changed
            expect(result).not.toBe(prevElements);
        });

        it('should detect changes even when elements are reordered', () => {
            const prevElements = [
                { id: 'node-1', data: { label: 'Node 1' } },
                { id: 'node-2', data: { label: 'Node 2' } },
                { id: 'node-3', data: { label: 'Node 3' } }
            ];
            const newElements = [
                { id: 'node-3', data: { label: 'Node 3' } },
                { id: 'node-1', data: { label: 'Node 1 Updated' } }, // Changed + reordered
                { id: 'node-2', data: { label: 'Node 2' } }
            ];

            const result = mergeFlowElements(prevElements, newElements);

            // node-3 should preserve reference
            expect(result[0]).toBe(prevElements[2]);
            // node-1 should be new reference (changed)
            expect(result[1]).toBe(newElements[1]);
            expect(result[1]).not.toBe(prevElements[0]);
            // node-2 should preserve reference
            expect(result[2]).toBe(prevElements[1]);

            // Should return new array (not prevElements)
            expect(result).not.toBe(prevElements);
        });
    });

    describe('React Flow edge cases', () => {
        it('should handle nodes with complex nested data', () => {
            const prevElements = [
                {
                    id: 'service-web',
                    type: 'serviceNode',
                    data: {
                        label: 'web',
                        ports: ['80:80', '443:443'],
                        networks: ['frontend', 'backend'],
                        volumes: ['./data:/app/data']
                    },
                    position: { x: 100, y: 100 }
                }
            ];
            const newElements = [
                {
                    id: 'service-web',
                    type: 'serviceNode',
                    data: {
                        label: 'web',
                        ports: ['80:80', '443:443'],
                        networks: ['frontend', 'backend'],
                        volumes: ['./data:/app/data']
                    },
                    position: { x: 100, y: 100 }
                }
            ];

            const result = mergeFlowElements(prevElements, newElements);

            expect(result[0]).toBe(prevElements[0]);
            expect(result).toBe(prevElements);
        });

        it('should handle empty arrays', () => {
            expect(mergeFlowElements([], [])).toEqual([]);
        });

        it('should handle mixed element types (nodes and edges)', () => {
            const prevElements = [
                { id: 'node-1', type: 'serviceNode', data: {} },
                { id: 'edge-1', source: 'node-1', target: 'node-2' }
            ];
            const newElements = [
                { id: 'node-1', type: 'serviceNode', data: {} },
                { id: 'edge-1', source: 'node-1', target: 'node-2' }
            ];

            const result = mergeFlowElements(prevElements, newElements);

            expect(result[0]).toBe(prevElements[0]);
            expect(result[1]).toBe(prevElements[1]);
            expect(result).toBe(prevElements);
        });
    });
});
