/**
 * Web Worker for Docker Compose parsing.
 * Runs parsing off the main thread to prevent UI freeze.
 */

import { parseCompose } from '../utils/composeParser.js';

// Message types
const MESSAGE_TYPES = {
    PARSE: 'parse',
    PARSE_SUCCESS: 'parse_success',
    PARSE_ERROR: 'parse_error'
};

/**
 * Handle incoming messages from main thread.
 */
self.onmessage = (event) => {
    const { type, payload, id } = event.data;

    if (type === MESSAGE_TYPES.PARSE) {
        try {
            const { yamlString, options = {} } = payload;

            // Use the production-grade parser
            const result = parseCompose(yamlString, options);

            // Convert Set to Array for serialization
            const serializedResult = {
                ...result,
                variables: Array.from(result.variables || [])
            };

            self.postMessage({
                type: MESSAGE_TYPES.PARSE_SUCCESS,
                payload: serializedResult,
                id
            });
        } catch (error) {
            self.postMessage({
                type: MESSAGE_TYPES.PARSE_ERROR,
                payload: {
                    message: error.message,
                    stack: error.stack
                },
                id
            });
        }
    }
};

// Export for testing purposes (won't exist in worker context)
/* eslint-disable no-undef */
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { MESSAGE_TYPES };
}
/* eslint-enable no-undef */
