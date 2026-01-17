/**
 * Worker manager for async Docker Compose parsing.
 * Provides a Promise-based API for communicating with the parser worker.
 */

const MESSAGE_TYPES = {
    PARSE: 'parse',
    PARSE_SUCCESS: 'parse_success',
    PARSE_ERROR: 'parse_error'
};

let messageId = 0;

/**
 * Create and manage a parser worker instance.
 * @returns {{parseAsync: Function, terminate: Function}} Worker manager
 */
export function createParserWorker() {
    let worker = null;
    const pendingRequests = new Map();

    /**
     * Initialize the worker (lazy loading).
     */
    function initWorker() {
        if (worker) return;

        try {
            worker = new Worker(
                new URL('../workers/parserWorker.js', import.meta.url),
                { type: 'module' }
            );

            worker.onmessage = (event) => {
                const { type, payload, id } = event.data;
                const request = pendingRequests.get(id);

                if (!request) return;

                pendingRequests.delete(id);

                if (type === MESSAGE_TYPES.PARSE_SUCCESS) {
                    request.resolve(payload);
                } else if (type === MESSAGE_TYPES.PARSE_ERROR) {
                    request.reject(new Error(payload.message));
                }
            };

            worker.onerror = (error) => {
                console.error('Parser worker error:', error);
                // Reject all pending requests
                for (const [id, request] of pendingRequests.entries()) {
                    request.reject(new Error('Worker error: ' + error.message));
                    pendingRequests.delete(id);
                }
            };
        } catch (error) {
            console.error('Failed to create parser worker:', error);
            throw new Error('Web Worker not supported or failed to initialize');
        }
    }

    /**
     * Parse Docker Compose YAML asynchronously.
     * @param {string} yamlString - YAML content to parse
     * @param {Object} options - Parser options
     * @returns {Promise<{compose, profiles, variables, errors}>} Parsed result
     */
    function parseAsync(yamlString, options = {}) {
        initWorker();

        return new Promise((resolve, reject) => {
            const id = messageId++;

            pendingRequests.set(id, { resolve, reject });

            worker.postMessage({
                type: MESSAGE_TYPES.PARSE,
                payload: { yamlString, options },
                id
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Parser timeout after 30s'));
                }
            }, 30000);
        });
    }

    /**
     * Terminate the worker and clean up.
     */
    function terminate() {
        if (worker) {
            worker.terminate();
            worker = null;
        }
        pendingRequests.clear();
    }

    return {
        parseAsync,
        terminate
    };
}
