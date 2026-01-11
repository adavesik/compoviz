import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, AlertCircle, Download, Maximize } from 'lucide-react';
import { Graphviz } from '@hpcc-js/wasm-graphviz';
import { IconButton } from '../../components/ui';
import ContextMenu from './ContextMenu';

// Cache the Graphviz instance
let graphvizInstance = null;
const getGraphviz = async () => {
    if (!graphvizInstance) {
        graphvizInstance = await Graphviz.load();
    }
    return graphvizInstance;
};

/**
 * Graphviz diagram with pan/zoom and right-click context menu
 */
export const GraphvizDiagram = memo(({ dot, onNodeClick, onAdd }) => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [error, setError] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [loading, setLoading] = useState(true);

    // Render DOT to SVG
    useEffect(() => {
        const render = async () => {
            if (!containerRef.current || !dot) return;
            try {
                setError(null);
                setLoading(true);
                const graphviz = await getGraphviz();
                const svg = graphviz.dot(dot);
                containerRef.current.innerHTML = svg;
                svgRef.current = containerRef.current.querySelector('svg');

                // Style the SVG
                if (svgRef.current) {
                    svgRef.current.style.width = '100%';
                    svgRef.current.style.height = '100%';
                    svgRef.current.style.maxWidth = 'none';
                    svgRef.current.style.maxHeight = 'none';

                    // Add click handlers to nodes
                    svgRef.current.querySelectorAll('.node').forEach(node => {
                        node.style.cursor = 'pointer';
                        node.addEventListener('click', () => {
                            const title = node.querySelector('title')?.textContent;
                            if (title && !title.startsWith('cluster_') &&
                                !title.startsWith('vol_') &&
                                !title.startsWith('sec_') &&
                                !title.startsWith('cfg_') &&
                                !title.startsWith('hp_')) {
                                onNodeClick?.({ type: 'services', name: title });
                            }
                        });
                    });
                }
                setLoading(false);
            } catch (e) {
                setError(e.message);
                setLoading(false);
            }
        };
        render();
    }, [dot, onNodeClick]);

    // Pan handlers
    const handleMouseDown = (e) => {
        if (e.button === 0) {
            setDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };
    const handleMouseMove = (e) => {
        if (dragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const handleMouseUp = () => setDragging(false);

    // Zoom handlers
    const zoomIn = useCallback(() => setScale(s => Math.min(s + 0.2, 3)), []);
    const zoomOut = useCallback(() => setScale(s => Math.max(s - 0.2, 0.3)), []);
    const resetView = useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    // Fit to screen
    const fitToScreen = useCallback(() => {
        if (!svgRef.current || !containerRef.current?.parentElement) return;
        const parent = containerRef.current.parentElement;
        const svgBBox = svgRef.current.getBBox();
        const scaleX = parent.clientWidth / (svgBBox.width + 100);
        const scaleY = parent.clientHeight / (svgBBox.height + 100);
        const newScale = Math.min(scaleX, scaleY, 1.5);
        setScale(newScale);
        setPosition({ x: 0, y: 0 });
    }, []);

    // Download SVG
    const downloadSvg = useCallback(() => {
        if (!containerRef.current) return;
        const svgElement = containerRef.current.querySelector('svg');
        if (!svgElement) return;

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'docker-compose-diagram.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    // Context menu
    const handleContextMenu = (e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    // Wheel zoom
    const handleWheel = useCallback((e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setScale(s => Math.min(Math.max(s + delta, 0.3), 3));
        }
    }, []);

    if (error) return (
        <div className="flex items-center justify-center h-full text-cyber-error">
            <AlertCircle className="mr-2" />Diagram Error: {error}
        </div>
    );

    return (
        <div className="relative h-full">
            {/* Controls */}
            <div className="absolute top-2 right-2 z-10 flex gap-1 glass rounded-lg p-1">
                <IconButton icon={ZoomIn} onClick={zoomIn} title="Zoom In" />
                <IconButton icon={ZoomOut} onClick={zoomOut} title="Zoom Out" />
                <IconButton icon={Maximize} onClick={fitToScreen} title="Fit to Screen" />
                <IconButton icon={RotateCcw} onClick={resetView} title="Reset View" />
                <div className="w-px bg-cyber-border/50 mx-1" />
                <IconButton icon={Download} onClick={downloadSvg} title="Download SVG" />
            </div>

            {/* Hint for right-click */}
            <div className="absolute top-2 left-2 z-10 text-xs text-cyber-text-muted glass rounded-lg px-3 py-1.5">
                💡 Right-click to add resources
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 glass rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-cyber-text-muted uppercase tracking-wide mb-2">Legend</div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-0.5 bg-pink-400" style={{ boxShadow: '0 0 6px #f472b6' }}></div>
                    <span className="text-sm text-cyber-text">Depends On</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-0.5 bg-cyan-400 border-dashed" style={{ borderTop: '2px dashed #22d3ee', height: 0 }}></div>
                    <span className="text-sm text-cyber-text">Network</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-0.5" style={{ borderTop: '2px dotted #fbbf24' }}></div>
                    <span className="text-sm text-cyber-text">Volume Mount</span>
                </div>
            </div>

            {/* Loading indicator */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-cyber-bg/50 z-20">
                    <div className="text-cyber-accent animate-pulse">Loading diagram...</div>
                </div>
            )}

            {/* Diagram */}
            <div
                className="mermaid-container"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={handleContextMenu}
                onWheel={handleWheel}
            >
                <div
                    ref={containerRef}
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: 'center center',
                        transition: dragging ? 'none' : 'transform 0.2s'
                    }}
                    className="w-full h-full flex items-center justify-center"
                />
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onAdd={onAdd}
                />
            )}
        </div>
    );
});

GraphvizDiagram.displayName = 'GraphvizDiagram';

export default GraphvizDiagram;
