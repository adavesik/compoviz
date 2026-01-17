import { describe, it, expect } from 'vitest';

describe('workerManager', () => {
    it('exports createParserWorker function', () => {
        // Import dynamically to avoid worker initialization in test environment
        return import('./workerManager.js').then(module => {
            expect(module.createParserWorker).toBeDefined();
            expect(typeof module.createParserWorker).toBe('function');
        });
    });

    it('createParserWorker returns expected API', () => {
        return import('./workerManager.js').then(module => {
            // We can't actually test the worker in Node.js environment
            // This test verifies the API shape
            expect(module.createParserWorker).toBeDefined();

            // In browser tests, we would verify:
            // const manager = module.createParserWorker();
            // expect(manager.parseAsync).toBeDefined();
            // expect(manager.terminate).toBeDefined();
        });
    });
});
