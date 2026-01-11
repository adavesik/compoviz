// Dedicated worker to isolate Graphviz wasm rendering.
import { Graphviz } from '@hpcc-js/wasm-graphviz';

let graphvizPromise = null;
const fatalPatterns = ['out of bounds', 'signature mismatch'];

const getGraphviz = async () => {
    if (!graphvizPromise) {
        graphvizPromise = Graphviz.load();
    }
    return graphvizPromise;
};

self.onmessage = async (event) => {
    const { id, dot } = event.data || {};
    if (!id || !dot) return;

    try {
        const graphviz = await getGraphviz();
        const svg = graphviz.dot(dot);
        self.postMessage({ id, ok: true, svg });
    } catch (error) {
        const message = error?.message || 'Graphviz render failed';
        const fatal = fatalPatterns.some(p => message.includes(p));
        self.postMessage({ id, ok: false, error: message, fatal });
        if (fatal) {
            // Kill the worker so the main thread can spawn a fresh, clean instance.
            self.close();
        }
    }
};
