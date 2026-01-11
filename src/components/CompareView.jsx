import { useState, useRef, useEffect, memo } from 'react';
import { Graphviz } from '@hpcc-js/wasm-graphviz';
import { Upload, AlertCircle, Trash2, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useMultiProject } from '../hooks/useMultiProject';
import { compareProjects, getComparisonSummary } from '../utils/comparison';
import { generateMultiProjectGraphviz } from '../utils/graphviz';

// Conflict Panel Component
const ConflictPanel = ({ results }) => {
    const summary = getComparisonSummary(results);
    const [expandedIdx, setExpandedIdx] = useState(null);

    const severityIcon = {
        error: <XCircle size={14} className="text-cyber-error" />,
        warning: <AlertTriangle size={14} className="text-cyber-warning" />,
        info: <Info size={14} className="text-cyber-accent" />,
    };

    const severityBg = {
        error: 'bg-cyber-error/10 border-cyber-error/30',
        warning: 'bg-cyber-warning/10 border-cyber-warning/30',
        info: 'bg-cyber-accent/10 border-cyber-accent/30',
    };

    if (results.length === 0) {
        return (
            <div className="p-4 text-center text-cyber-text-muted">
                <Info size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conflicts or shared resources detected</p>
            </div>
        );
    }

    return (
        <div className="p-3 space-y-3">
            {/* Summary */}
            <div className="flex gap-3 text-xs">
                {summary.errors > 0 && (
                    <span className="flex items-center gap-1 text-cyber-error">
                        <XCircle size={12} /> {summary.errors} error{summary.errors !== 1 && 's'}
                    </span>
                )}
                {summary.warnings > 0 && (
                    <span className="flex items-center gap-1 text-cyber-warning">
                        <AlertTriangle size={12} /> {summary.warnings} warning{summary.warnings !== 1 && 's'}
                    </span>
                )}
                {summary.info > 0 && (
                    <span className="flex items-center gap-1 text-cyber-accent">
                        <Info size={12} /> {summary.info} shared
                    </span>
                )}
            </div>

            {/* Results list */}
            {results.map((result, idx) => (
                <div
                    key={idx}
                    className={`p-2 rounded-lg border cursor-pointer transition-all hover:brightness-110 ${severityBg[result.severity]}`}
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                >
                    <div className="flex items-start gap-2">
                        {severityIcon[result.severity]}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{result.message}</p>
                            <p className="text-xs text-cyber-text-muted mt-1">
                                Projects: {result.projects.join(', ')}
                                <span className="ml-2 text-cyber-accent">
                                    {expandedIdx === idx ? '▲ collapse' : '▼ details'}
                                </span>
                            </p>
                        </div>
                    </div>
                    {/* Expanded details */}
                    {expandedIdx === idx && result.details && Array.isArray(result.details) && (
                        <div className="mt-3 pt-2 border-t border-white/10 space-y-1.5 animate-fade-in">
                            <p className="text-xs text-cyber-text-muted font-medium mb-2">Affected services:</p>
                            {result.details.map((detail, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs bg-black/20 rounded px-2 py-1">
                                    <span className="font-medium text-cyber-text">{detail.project}</span>
                                    <span className="text-cyber-text-muted">→</span>
                                    <span className="text-cyber-accent font-medium">{detail.service}</span>
                                    {detail.mapping && (
                                        <code className="ml-auto bg-cyber-surface px-1.5 py-0.5 rounded text-cyber-warning font-mono">
                                            {detail.mapping}
                                        </code>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// Cache the Graphviz instance
let graphvizInstance = null;
const getGraphviz = async () => {
    if (!graphvizInstance) {
        graphvizInstance = await Graphviz.load();
    }
    return graphvizInstance;
};

// Multi-Project Diagram with Graphviz rendering
const MultiProjectDiagram = memo(({ projects, conflicts }) => {
    const containerRef = useRef(null);
    const [scale, setScale] = useState(0.8);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const render = async () => {
            if (!containerRef.current) return;
            try {
                setError(null);
                setLoading(true);
                const dot = generateMultiProjectGraphviz(projects, conflicts);
                const graphviz = await getGraphviz();
                const svg = graphviz.dot(dot);
                containerRef.current.innerHTML = svg;

                // Style the SVG
                const svgElement = containerRef.current.querySelector('svg');
                if (svgElement) {
                    svgElement.style.width = '100%';
                    svgElement.style.height = '100%';
                    svgElement.style.maxWidth = 'none';
                    svgElement.style.maxHeight = 'none';
                }
                setLoading(false);
            } catch (e) {
                setError(e.message);
                setLoading(false);
            }
        };
        render();
    }, [projects, conflicts]);

    const handleMouseDown = (e) => { setDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); };
    const handleMouseMove = (e) => { if (dragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
    const handleMouseUp = () => setDragging(false);
    const resetView = () => { setScale(0.8); setPosition({ x: 0, y: 0 }); };

    if (error) {
        return (
            <div className="flex items-center justify-center h-full text-cyber-error">
                <AlertCircle className="mr-2" />Diagram Error: {error}
            </div>
        );
    }

    return (
        <div className="relative h-full">
            {/* Controls */}
            <div className="absolute top-2 right-2 z-10 flex gap-1 glass rounded-lg p-1">
                <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 hover:bg-cyber-surface-light rounded" title="Zoom In">
                    <ZoomIn size={18} />
                </button>
                <button onClick={() => setScale(s => Math.max(s - 0.1, 0.3))} className="p-2 hover:bg-cyber-surface-light rounded" title="Zoom Out">
                    <ZoomOut size={18} />
                </button>
                <button onClick={resetView} className="p-2 hover:bg-cyber-surface-light rounded" title="Reset View">
                    <RotateCcw size={18} />
                </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-10 glass rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-cyber-text-muted uppercase tracking-wide mb-2">Legend</div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#1e3a8a] border-2 border-[#3b82f6]"></div>
                    <span className="text-xs">Project A</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#065f46] border-2 border-[#10b981]"></div>
                    <span className="text-xs">Project B</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#164e63] border-2 border-[#06b6d4]"></div>
                    <span className="text-xs">Project C</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#991b1b] border-2 border-[#ef4444]"></div>
                    <span className="text-xs">Conflict</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-[#4c1d95] border-2 border-[#a78bfa] border-dashed"></div>
                    <span className="text-xs">Shared</span>
                </div>
            </div>

            {/* Diagram */}
            <div
                className="h-full overflow-hidden cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
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
        </div>
    );
});

// Main Compare View Component
export default function CompareView() {
    const {
        projects,
        addProject,
        removeProject,
        clearAllProjects,
    } = useMultiProject();

    const fileInputRef = useRef(null);
    const [comparisonResults, setComparisonResults] = useState([]);
    const [isDragging, setIsDragging] = useState(false);

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

    // Run comparison whenever projects change
    useEffect(() => {
        if (projects.length >= 2) {
            const results = compareProjects(projects);
            setComparisonResults(results);
        } else {
            setComparisonResults([]);
        }
    }, [projects]);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = addProject(event.target?.result, file.name);
                if (!result.success) {
                    alert('Failed to parse YAML: ' + result.error);
                }
            };
            reader.readAsText(file);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="h-full w-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-cyber-border/50 glass">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold">Multi-Project Comparison</h2>
                        <p className="text-sm text-cyber-text-muted">Load up to 3 docker-compose files to compare</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={projects.length >= 3}
                            className="btn btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Upload size={16} />
                            Load Project ({projects.length}/3)
                        </button>
                        {projects.length > 0 && (
                            <button onClick={clearAllProjects} className="btn btn-secondary">
                                Clear All
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".yml,.yaml"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>
                </div>

                {/* Project Pills */}
                {projects.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {projects.map((project, idx) => (
                            <div
                                key={project.id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${idx === 0 ? 'bg-blue-500/10 border-blue-500/30' :
                                    idx === 1 ? 'bg-green-500/10 border-green-500/30' :
                                        'bg-cyan-500/10 border-cyan-500/30'
                                    }`}
                            >
                                <span className="text-lg">{['🔵', '🟢', '🩵'][idx]}</span>
                                <span className="text-sm font-medium">{project.name}</span>
                                <span className="text-xs text-cyber-text-muted">
                                    ({Object.keys(project.content?.services || {}).length} services)
                                </span>
                                <button
                                    onClick={() => removeProject(project.id)}
                                    className="p-1 hover:bg-cyber-surface-light rounded"
                                >
                                    <Trash2 size={14} className="text-cyber-text-muted hover:text-cyber-error" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {projects.length === 0 ? (
                    <div
                        className={`flex-1 flex flex-col items-center justify-center text-cyber-text-muted transition-all duration-300 m-4 border-2 border-dashed rounded-xl ${isDragging ? 'border-cyber-accent bg-cyber-accent/5' : 'border-transparent'}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className={`text-center transition-all duration-300 ${isDragging ? 'scale-110' : ''}`}>
                            <Upload size={48} className={`mx-auto mb-4 ${isDragging ? 'text-cyber-accent animate-bounce' : 'opacity-50'}`} />
                            <p className="text-lg mb-2 font-medium">Load docker-compose files to compare</p>
                            <p className="text-sm">Upload at least 2 files to see conflicts and shared resources</p>
                            <p className="text-xs mt-4 text-cyber-text-muted">Drag & drop up to 3 files here</p>
                        </div>
                    </div>
                ) : projects.length === 1 ? (
                    <div
                        className={`flex-1 flex flex-col items-center justify-center text-cyber-text-muted transition-all duration-300 m-4 border-2 border-dashed rounded-xl ${isDragging ? 'border-cyber-accent bg-cyber-accent/5' : 'border-transparent'}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className={`text-center transition-all duration-300 ${isDragging ? 'scale-110' : ''}`}>
                            <AlertCircle size={48} className={`mx-auto mb-4 ${isDragging ? 'text-cyber-accent animate-bounce' : 'opacity-50'}`} />
                            <p className="text-lg mb-2 font-medium">Load one more project</p>
                            <p className="text-sm">Need at least 2 projects to compare</p>
                            <p className="text-xs mt-4 text-cyber-text-muted">Drag & drop another file here</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Diagram */}
                        <div className="flex-1 p-4">
                            <div className="h-full glass rounded-xl overflow-hidden">
                                <MultiProjectDiagram projects={projects} conflicts={comparisonResults} />
                            </div>
                        </div>

                        {/* Conflicts Panel */}
                        <div className="w-80 border-l border-cyber-border/50 glass-light flex flex-col">
                            <div className="p-3 border-b border-cyber-border/50">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <AlertCircle size={16} className="text-cyber-warning" />
                                    Analysis Results
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <ConflictPanel results={comparisonResults} />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
