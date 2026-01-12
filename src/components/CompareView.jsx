import { useState, useRef, useEffect, memo, useMemo } from 'react';
import { Upload, AlertCircle, Trash2, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Info, XCircle, Plus } from 'lucide-react';
import { useMultiProject } from '../hooks/useMultiProject';
import { compareProjects, getComparisonSummary } from '../utils/comparison';
import { renderDot, resetGraphviz } from '../utils/graphvizRenderer';
import { generateMultiProjectGraphviz, sanitizeSvg } from '../utils/graphviz';

/**
 * Diagram view for multi-project comparison
 */
const DiagramView = memo(({ projects, conflicts }) => {
    const containerRef = useRef(null);
    const [scale, setScale] = useState(0.8);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const render = async () => {
            if (!containerRef.current) return;
            try {
                setError(null);
                const dot = generateMultiProjectGraphviz(projects, conflicts);
                const svgString = await renderDot(dot);
                if (cancelled || !containerRef.current) return;

                const svgElement = sanitizeSvg(svgString);
                containerRef.current.replaceChildren(svgElement);

                // Style the SVG
                if (svgElement) {
                    svgElement.style.width = '100%';
                    svgElement.style.height = '100%';
                    svgElement.style.maxWidth = 'none';
                    svgElement.style.maxHeight = 'none';
                }
            } catch (e) {
                if (cancelled) return;
                setError(e.message);
            }
        };
        render();
        return () => {
            cancelled = true;
        };
    }, [projects, conflicts]);

    useEffect(() => {
        return () => {
            resetGraphviz();
        };
    }, []);

    const handleMouseDown = (e) => { setDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); };
    const handleMouseMove = (e) => { if (dragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
    const handleMouseUp = () => setDragging(false);
    const resetView = () => { setScale(0.8); setPosition({ x: 0, y: 0 }); };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-cyber-error">
                <AlertCircle size={48} className="mb-4" />
                <h3 className="text-xl font-bold mb-2">Diagram Rendering Failed</h3>
                <p className="max-w-md">{error}</p>
            </div>
        );
    }

    return (
        <div
            className="w-full h-full relative cursor-grab overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                ref={containerRef}
                className="w-full h-full flex items-center justify-center transition-transform duration-75"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    pointerEvents: dragging ? 'none' : 'auto'
                }}
            />

            {/* View Controls */}
            <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-3 glass rounded-xl text-cyber-accent hover:text-cyber-text hover:bg-cyber-accent/20 transition-all shadow-lg" title="Zoom In"><ZoomIn size={20} /></button>
                <button onClick={() => setScale(s => Math.max(s - 0.1, 0.2))} className="p-3 glass rounded-xl text-cyber-accent hover:text-cyber-text hover:bg-cyber-accent/20 transition-all shadow-lg" title="Zoom Out"><ZoomOut size={20} /></button>
                <button onClick={resetView} className="p-3 glass rounded-xl text-cyber-accent hover:text-cyber-text hover:bg-cyber-accent/20 transition-all shadow-lg" title="Reset View"><RotateCcw size={20} /></button>
            </div>

            {/* Hint */}
            <div className="absolute bottom-6 left-6 p-4 glass rounded-xl border border-cyber-border/50 text-xs text-cyber-text-muted select-none pointer-events-none shadow-lg">
                💡 Drag to pan, scroll or use buttons to zoom
            </div>
        </div>
    );
});

DiagramView.displayName = 'DiagramView';

// Main Compare View Component
function CompareView() {
    const {
        projects,
        addProject,
        removeProject,
        clearAllProjects,
    } = useMultiProject();

    const fileInputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // Run comparison whenever projects change
    const comparisonResults = useMemo(() => {
        if (projects.length >= 2) {
            return compareProjects(projects);
        }
        return [];
    }, [projects]);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));

        if (files.length === 0) return;

        const canAdd = 3 - projects.length;
        if (canAdd <= 0) {
            alert('Maximum of 3 projects allowed. Please remove a project first.');
            return;
        }

        const filesToProcess = files.slice(0, canAdd);

        filesToProcess.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = addProject(event.target?.result, file.name);
                if (!result.success) {
                    alert(`Failed to parse ${file.name}: ${result.error}`);
                }
            };
            reader.readAsText(file);
        });
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = addProject(event.target?.result, file.name);
                if (!result.success) {
                    alert(`Failed to parse ${file.name}: ${result.error}`);
                }
            };
            reader.readAsText(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const conflicts = comparisonResults.filter(r => r.type === 'error');
    const summary = getComparisonSummary(comparisonResults);

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Project Management Header */}
            <div className="p-4 bg-cyber-surface border-b border-cyber-border/50 shadow-lg z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {projects.map(p => (
                                <div key={p.id} className="group relative flex items-center gap-2 px-3 py-1.5 glass rounded-lg border border-cyber-accent/30 hover:border-cyber-accent transition-all">
                                    <span className="text-sm font-medium truncate max-w-[120px]">{p.name}</span>
                                    <button
                                        onClick={() => removeProject(p.id)}
                                        className="text-cyber-text-muted hover:text-cyber-error transition-colors"
                                    >
                                        <XCircle size={14} />
                                    </button>
                                </div>
                            ))}
                            {projects.length < 3 && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 rounded-lg border border-dashed border-cyber-accent/30 text-cyber-accent hover:bg-cyber-accent/10 transition-all flex items-center gap-2"
                                    title="Add Project"
                                >
                                    <Plus size={16} />
                                    <span className="text-xs font-semibold uppercase tracking-wider pr-1">Add Project</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {projects.length > 0 && (
                            <button
                                onClick={clearAllProjects}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-cyber-text-muted hover:text-cyber-error hover:bg-cyber-error/10 transition-all"
                            >
                                <Trash2 size={16} />
                                Clear All
                            </button>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".yml,.yaml"
                            className="hidden"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {projects.length < 2 ? (
                    <div
                        className={`h-full flex flex-col items-center justify-center p-8 transition-all ${isDragging ? 'bg-cyber-accent/5' : ''
                            }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="max-w-md w-full text-center space-y-6">
                            <div className="relative group mx-auto w-24 h-24 mb-6">
                                <div className="absolute inset-0 bg-cyber-accent/20 rounded-full blur-2xl group-hover:bg-cyber-accent/40 transition-all animate-pulse" />
                                <div className="relative flex items-center justify-center w-full h-full glass rounded-full border border-cyber-accent/30 group-hover:border-cyber-accent transition-all">
                                    <Upload size={40} className="text-cyber-accent" />
                                </div>
                            </div>

                            <div>
                                <h1 className="text-3xl font-bold mb-3 tracking-tight">Compare Projects</h1>
                                <p className="text-cyber-text-muted text-lg">
                                    {projects.length === 0
                                        ? "Drop up to 3 Docker Compose files here to analyze conflicts and dependencies across projects."
                                        : "Drop another compose file to start the comparison analysis."
                                    }
                                </p>
                            </div>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-8 py-4 bg-cyber-accent text-white rounded-2xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-cyber-accent/20"
                            >
                                Choose Files
                            </button>

                            <div className="grid grid-cols-2 gap-4 text-left">
                                <div className="p-4 glass rounded-2xl border border-cyber-border/50">
                                    <AlertTriangle className="text-cyber-warning mb-2" size={20} />
                                    <h3 className="font-semibold text-sm">Conflict Detection</h3>
                                    <p className="text-xs text-cyber-text-muted mt-1">Identifies overlapping ports, networks, and service names.</p>
                                </div>
                                <div className="p-4 glass rounded-2xl border border-cyber-border/50">
                                    <Info className="text-cyber-accent mb-2" size={20} />
                                    <h3 className="font-semibold text-sm">Visual Mapping</h3>
                                    <p className="text-xs text-cyber-text-muted mt-1">Generates a unified diagram of all interacting components.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Comparison Summary Overlay */}
                        <div className="absolute top-6 left-6 z-20 w-80 space-y-4">
                            <div className="glass p-5 rounded-2xl border border-cyber-border/50 shadow-2xl animate-slide-in">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    Analysis Results
                                    {conflicts.length > 0 ? (
                                        <Badge index={0} type="error">{conflicts.length} Conflicts</Badge>
                                    ) : (
                                        <Badge index={1} type="success">No Conflicts</Badge>
                                    )}
                                </h3>

                                <div className="space-y-4">
                                    <p className="text-sm text-cyber-text-muted leading-relaxed">{summary}</p>

                                    {comparisonResults.length > 0 && (
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                            {comparisonResults.map((res, idx) => (
                                                <div key={idx} className={`p-3 rounded-xl border text-xs flex gap-3 ${res.type === 'error'
                                                    ? 'bg-cyber-error/10 border-cyber-error/30 text-cyber-error'
                                                    : 'bg-cyber-warning/10 border-cyber-warning/30 text-cyber-warning'
                                                    }`}>
                                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                                    <div className="space-y-1">
                                                        <p className="font-bold uppercase tracking-wider text-[10px] opacity-70">{res.category}</p>
                                                        <p className="font-medium leading-normal">{res.message}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Unified Diagram View */}
                        <div className="w-full h-full bg-[#0b0f1a]">
                            <DiagramView projects={projects} conflicts={conflicts} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Helper badge component for summary
const Badge = memo(({ children, type }) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${type === 'error' ? 'bg-cyber-error text-white' : 'bg-cyber-success text-white'
        }`}>
        {children}
    </span>
));

Badge.displayName = 'Badge';
CompareView.displayName = 'CompareView';

export default CompareView;
