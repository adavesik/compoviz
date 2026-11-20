import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { buildMultiProjectGraph } from '../../utils/graphviz';
import { renderDot, resetGraphviz } from '../../utils/graphvizRenderer';
import { sanitizeSvg } from '../../utils/sanitizeSvg';
import { usePanZoom } from '../../hooks/usePanZoom';
import './compare.css';

// Graphviz measures text with Helvetica/Courier metrics; these widely available
// fonts have similar widths, so labels still fit their boxes.
const UI_FONT_STACK = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
const MONO_FONT_STACK = 'Consolas, "Cascadia Mono", "SF Mono", Menlo, "Liberation Mono", monospace';

/**
 * Work out which diagram elements relate to the current selection.
 * @returns {{ selected: Set<string>, related: Set<string> }} element ids
 */
function computeHighlight(selection, graph, results) {
    const selected = new Set();
    const related = new Set();
    if (!selection) return { selected, related };

    const { nodeMap, edgeMap, clusterMap } = graph;
    const nodeIdFor = (projectId, service) => Object.keys(nodeMap).find(id => {
        const n = nodeMap[id];
        return n.kind === 'service' && n.projectId === projectId && n.service === service;
    });
    const addResult = (result) => {
        for (const d of Array.isArray(result.details) ? result.details : []) {
            const id = d.service && nodeIdFor(d.projectId, d.service);
            if (id) related.add(id);
        }
        for (const [id, n] of Object.entries(nodeMap)) {
            if (n.kind === 'resource' && n.resultId === result.id) related.add(id);
        }
        for (const [edgeId, resultIds] of Object.entries(edgeMap)) {
            if (resultIds.includes(result.id)) related.add(edgeId);
        }
    };

    if (selection.type === 'service') {
        const id = nodeIdFor(selection.projectId, selection.service);
        if (id) { selected.add(id); related.add(id); }
        results
            .filter(r => Array.isArray(r.details) && r.details.some(d => d.projectId === selection.projectId && d.service === selection.service))
            .forEach(addResult);
    } else if (selection.type === 'result') {
        const result = results.find(r => r.id === selection.resultId);
        if (result) addResult(result);
        for (const [id, n] of Object.entries(nodeMap)) {
            if (n.kind === 'resource' && n.resultId === selection.resultId) selected.add(id);
        }
        if (result?.category === 'project_name') {
            for (const [clusterId, projectId] of Object.entries(clusterMap)) {
                if (result.projectIds?.includes(projectId)) selected.add(clusterId);
            }
        }
    } else if (selection.type === 'project') {
        for (const [id, n] of Object.entries(nodeMap)) {
            if (n.kind === 'service' && n.projectId === selection.projectId) related.add(id);
        }
        for (const [clusterId, projectId] of Object.entries(clusterMap)) {
            if (projectId === selection.projectId) selected.add(clusterId);
        }
    }
    return { selected, related };
}

/**
 * Interactive compare-mode diagram.
 *
 * Imperative API (via ref): fit(), zoomIn(), zoomOut(), focusSelection(), exportSvg(), getScale()
 */
const CompareDiagram = forwardRef(function CompareDiagram({
    projects,
    results,
    dismissed,
    selection,
    onSelect,
    onContextMenu,
    onHover,
    getInsets,
    onViewChange,
}, ref) {
    const contentRef = useRef(null);
    const svgRef = useRef(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [renderVersion, setRenderVersion] = useState(0);
    const hasFittedRef = useRef(null);
    const projectsKey = useMemo(() => projects.map(p => p.id).join('|'), [projects]);

    const panZoom = usePanZoom({ minScale: 0.1, maxScale: 4, getInsets });
    const { viewportRef, contentStyle, isPanning, fit, zoomBy, focusRect, toContentRect, setContentSize, wasDrag, viewportHandlers, view } = panZoom;

    const graph = useMemo(
        () => buildMultiProjectGraph(projects, results, { dismissed }),
        [projects, results, dismissed]
    );
    const graphRef = useRef(graph);
    useEffect(() => { graphRef.current = graph; }, [graph]);
    const selectionRef = useRef(selection);
    useEffect(() => { selectionRef.current = selection; }, [selection]);

    useEffect(() => { onViewChange?.(view.scale); }, [view.scale, onViewChange]);

    // ── Render DOT → SVG ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!contentRef.current) return;
            try {
                setError(null);
                setLoading(true);
                const svgString = await renderDot(graph.dot);
                if (cancelled || !contentRef.current) return;
                const svg = sanitizeSvg(svgString);
                if (!svg) throw new Error('Failed to sanitize SVG output');

                // Native <title> tooltips show internal ids; we render our own hover card
                svg.querySelectorAll('title').forEach(t => t.remove());

                // Swap Graphviz's layout fonts for real UI fonts in the SVG itself,
                // so exported SVGs look the same as the on-screen diagram
                svg.querySelectorAll('text').forEach(t => {
                    const isMono = /^courier/i.test(t.getAttribute('font-family') || '');
                    t.setAttribute('font-family', isMono ? MONO_FONT_STACK : UI_FONT_STACK);
                });

                // Give the SVG its natural pixel size so pan/zoom math is exact
                const vb = svg.viewBox?.baseVal;
                const width = vb?.width || parseFloat(svg.getAttribute('width')) || 800;
                const height = vb?.height || parseFloat(svg.getAttribute('height')) || 600;
                svg.setAttribute('width', `${width}`);
                svg.setAttribute('height', `${height}`);
                svg.style.width = `${width}px`;
                svg.style.height = `${height}px`;

                contentRef.current.replaceChildren(svg);
                svgRef.current = svg;
                setContentSize({ width, height });
                // Re-fit when the set of projects changes; keep the view when only fixes changed
                if (hasFittedRef.current !== projectsKey) {
                    hasFittedRef.current = projectsKey;
                    // Wait a frame so the viewport has its final size
                    requestAnimationFrame(() => fit(false));
                }
                setRenderVersion(v => v + 1);
                setLoading(false);
            } catch (e) {
                if (cancelled) return;
                setError(e.message);
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [graph, fit, setContentSize, projectsKey]);

    useEffect(() => () => resetGraphviz(), []);

    // ── Apply highlight classes ──
    useEffect(() => {
        const svg = svgRef.current;
        const content = contentRef.current;
        if (!svg || !content) return;
        const { selected, related } = computeHighlight(selection, graph, results);
        content.classList.toggle('has-selection', !!selection && related.size + selected.size > 0);
        svg.querySelectorAll('g.node, g.edge, g.cluster').forEach(el => {
            el.classList.toggle('cmp-related', related.has(el.id) || selected.has(el.id));
            el.classList.toggle('cmp-selected', selected.has(el.id));
        });
    }, [selection, graph, results, renderVersion]);

    // ── Hit testing ──
    const resolveTarget = useCallback((domTarget) => {
        const el = domTarget instanceof Element ? domTarget : null;
        if (!el) return null;
        const { nodeMap, edgeMap, clusterMap } = graphRef.current;
        const node = el.closest('g.node');
        if (node && nodeMap[node.id]) {
            const n = nodeMap[node.id];
            return n.kind === 'service'
                ? { type: 'service', projectId: n.projectId, service: n.service, elementId: node.id }
                : { type: 'result', resultId: n.resultId, elementId: node.id };
        }
        const edge = el.closest('g.edge');
        if (edge && edgeMap[edge.id]) {
            // A merged edge may carry several conflicts; cycle through them on repeated clicks
            const ids = edgeMap[edge.id];
            const current = selectionRef.current;
            const idx = current?.type === 'result' ? ids.indexOf(current.resultId) : -1;
            return { type: 'result', resultId: ids[(idx + 1) % ids.length], elementId: edge.id };
        }
        const cluster = el.closest('g.cluster');
        if (cluster && clusterMap[cluster.id]) return { type: 'project', projectId: clusterMap[cluster.id], elementId: cluster.id };
        return null;
    }, []);

    const handleClick = useCallback((e) => {
        if (wasDrag()) return;
        const target = resolveTarget(e.target);
        if (!target) { onSelect?.(null); return; }
        const { elementId, ...sel } = target;
        void elementId;
        onSelect?.(sel);
    }, [resolveTarget, onSelect, wasDrag]);

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        const target = resolveTarget(e.target);
        if (target) {
            const { elementId, ...sel } = target;
            void elementId;
            onContextMenu?.({ x: e.clientX, y: e.clientY, target: sel });
        } else {
            onContextMenu?.({ x: e.clientX, y: e.clientY, target: null });
        }
    }, [resolveTarget, onContextMenu]);

    const lastHoverRef = useRef(null);
    const handlePointerOver = useCallback((e) => {
        if (isPanning) return;
        const target = resolveTarget(e.target);
        const key = target?.elementId || null;
        if (key === lastHoverRef.current) return;
        lastHoverRef.current = key;
        onHover?.(target && target.type !== 'project' ? { ...target, x: e.clientX, y: e.clientY } : null);
    }, [resolveTarget, onHover, isPanning]);

    const handlePointerLeave = useCallback(() => {
        lastHoverRef.current = null;
        onHover?.(null);
    }, [onHover]);

    // ── Focus helpers ──
    const focusElements = useCallback((ids) => {
        const svg = svgRef.current;
        if (!svg || ids.length === 0) return false;
        let box = null;
        for (const id of ids) {
            const el = svg.getElementById ? svg.getElementById(id) : svg.querySelector(`#${CSS.escape(id)}`);
            if (!el) continue;
            const r = toContentRect(el.getBoundingClientRect());
            if (!r) continue;
            box = box
                ? {
                    x: Math.min(box.x, r.x),
                    y: Math.min(box.y, r.y),
                    right: Math.max(box.right, r.x + r.width),
                    bottom: Math.max(box.bottom, r.y + r.height),
                }
                : { x: r.x, y: r.y, right: r.x + r.width, bottom: r.y + r.height };
        }
        if (!box) return false;
        focusRect({ x: box.x, y: box.y, width: box.right - box.x, height: box.bottom - box.y }, { padding: 80, maxFitScale: 1.4 });
        return true;
    }, [focusRect, toContentRect]);

    const focusSelection = useCallback((sel = selection) => {
        if (!sel) return false;
        const { selected, related } = computeHighlight(sel, graphRef.current, results);
        const ids = [...new Set([...selected, ...related])].filter(id => !id.startsWith('edge_'));
        return focusElements(ids);
    }, [selection, results, focusElements]);

    const exportSvg = useCallback((fileName = 'compose-comparison.svg') => {
        const svg = svgRef.current;
        if (!svg) return;
        const clone = svg.cloneNode(true);
        clone.querySelectorAll('.cmp-related, .cmp-selected').forEach(el => el.classList.remove('cmp-related', 'cmp-selected'));
        clone.setAttribute('style', 'background:#0b0f1a');
        const data = new XMLSerializer().serializeToString(clone);
        const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }, []);

    useImperativeHandle(ref, () => ({
        fit: () => fit(true),
        zoomIn: () => zoomBy(1.25),
        zoomOut: () => zoomBy(0.8),
        focusSelection,
        exportSvg,
    }), [fit, zoomBy, focusSelection, exportSvg]);

    return (
        <div
            ref={viewportRef}
            className={`compare-viewport ${isPanning ? 'is-panning' : ''}`}
            {...viewportHandlers}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            onPointerOver={handlePointerOver}
            onPointerLeave={handlePointerLeave}
            role="application"
            aria-label="Project comparison diagram. Drag to pan, scroll to zoom, click a service to inspect it."
            data-testid="compare-diagram"
        >
            <div ref={contentRef} className="compare-content" style={contentStyle} />

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="flex items-center gap-2 text-accent text-sm glass px-4 py-2 rounded-xl">
                        <Loader2 size={16} className="animate-spin" /> Rendering diagram…
                    </div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-error">
                    <AlertCircle size={40} className="mb-3" />
                    <h3 className="text-lg font-bold mb-1">Diagram rendering failed</h3>
                    <p className="max-w-md text-sm">{error}</p>
                </div>
            )}
        </div>
    );
});

export default memo(CompareDiagram);
