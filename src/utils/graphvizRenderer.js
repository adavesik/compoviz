// Worker-backed Graphviz renderer with strict serialization and recovery.
const fatalPatterns = ['out of bounds', 'signature mismatch'];

class GraphvizWorkerClient {
    constructor() {
        this.worker = null;
        this.queue = Promise.resolve();
        this.requestId = 0;
        this.pending = new Map();
    }

    ensureWorker() {
        if (this.worker) return this.worker;

        this.worker = new Worker(new URL('./graphvizWorker.js', import.meta.url), { type: 'module' });

        this.worker.onmessage = (event) => {
            const { id, ok, svg, error, fatal } = event.data || {};
            const pending = this.pending.get(id);
            if (!pending) return;
            this.pending.delete(id);
            if (ok) {
                pending.resolve(svg);
            } else {
                const err = new Error(error || 'Graphviz render failed');
                err.fatal = !!fatal;
                pending.reject(err);
                if (fatal) this.resetWorker();
            }
        };

        this.worker.onerror = (event) => {
            const err = new Error(event.message || 'Graphviz worker error');
            err.fatal = true;
            this.pending.forEach(p => p.reject(err));
            this.pending.clear();
            this.resetWorker();
        };

        return this.worker;
    }

    resetWorker() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

    render(dot) {
        const task = () => this.renderWithRetry(dot);
        this.queue = this.queue.then(task, task);
        return this.queue;
    }

    async renderWithRetry(dot, attempt = 0) {
        try {
            return await this.renderOnce(dot);
        } catch (error) {
            const message = error?.message || '';
            const fatal = error?.fatal || fatalPatterns.some(p => message.includes(p));
            if (fatal && attempt < 1) {
                this.resetWorker();
                return this.renderWithRetry(dot, attempt + 1);
            }
            throw error;
        }
    }

    renderOnce(dot) {
        const worker = this.ensureWorker();
        const id = ++this.requestId;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            worker.postMessage({ id, dot });
        });
    }

    reset() {
        this.resetWorker();
        this.queue = Promise.resolve();
    }
}

const graphvizClient = new GraphvizWorkerClient();

export const renderDot = (dot) => graphvizClient.render(dot);
export const resetGraphviz = () => graphvizClient.reset();
