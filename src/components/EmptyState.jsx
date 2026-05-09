import { useState } from 'react';
import {
    Upload, PenTool, Eye, GitCompare, Zap, ArrowRight, Folder, Compass
} from 'lucide-react';
import ExamplesGallery from './ExamplesGallery';

/**
 * EmptyState — The first thing users see when no compose file is loaded.
 * Designed to convert visitors into active users with a clear CTA hierarchy:
 * 1. Try a demo (instant gratification)
 * 2. Import your own file
 * 3. Feature highlights to build confidence
 */
export default function EmptyState({ onImport, onTryDemo, onLoadExample, isDragging, setIsDragging, onDrop }) {
    const [hoveredFeature, setHoveredFeature] = useState(null);
    const [showGallery, setShowGallery] = useState(false);

    const features = [
        {
            id: 'builder',
            icon: PenTool,
            title: 'Visual Builder',
            desc: 'Drag-and-drop services, networks, and volumes onto an interactive canvas. Connect them visually.',
            color: 'var(--color-accent)',
        },
        {
            id: 'diagram',
            icon: Eye,
            title: 'Live Diagrams',
            desc: 'See your entire infrastructure rendered as a real-time Graphviz diagram. Click any node to edit.',
            color: 'var(--color-success)',
        },
        {
            id: 'compare',
            icon: GitCompare,
            title: 'Multi-Project Compare',
            desc: 'Load multiple compose files side by side. Spot conflicts, shared resources, and drift instantly.',
            color: 'var(--color-secret)',
        },
    ];

    return (
        <div
            className={`h-full flex flex-col overflow-auto ${isDragging ? 'empty-state-dragging' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
            onDrop={onDrop}
        >
            {/* ── Hero Section ── */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
                {/* Subtle background pattern */}
                <div className="empty-state-grid" />

                {/* Tagline */}
                <div className="empty-hero-entrance relative z-10 text-center max-w-xl">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-4 empty-stagger-1">
                        Docker Compose, visualized
                    </p>
                    <h2 className="text-3xl md:text-4xl font-display text-text leading-tight mb-4 empty-stagger-2">
                        Turn static YAML into<br />
                        <span className="bg-gradient-to-r from-accent to-secret bg-clip-text text-transparent">living architecture</span>
                    </h2>
                    <p className="text-text-secondary text-sm md:text-base leading-relaxed mb-8 empty-stagger-3">
                        Import a compose file or try a demo to see your services, networks, and volumes come alive as interactive diagrams.
                    </p>

                    {/* Primary CTA */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 empty-stagger-4">
                        <button
                            onClick={onTryDemo}
                            className="btn btn-primary px-6 py-2.5 text-sm flex items-center gap-2 group"
                        >
                            <Zap size={16} />
                            Try a Demo
                            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                        </button>

                        <label className="btn btn-secondary px-5 py-2.5 text-sm flex items-center gap-2 cursor-pointer">
                            <Upload size={16} />
                            Import File
                            <input type="file" accept=".yml,.yaml,.env" multiple className="hidden" onChange={onImport} />
                        </label>

                        <label className="btn btn-secondary px-5 py-2.5 text-sm flex items-center gap-2 cursor-pointer">
                            <Folder size={16} />
                            Import Folder
                            <input type="file" accept=".yml,.yaml,.env" webkitdirectory="true" className="hidden" onChange={onImport} />
                        </label>

                        <button
                            onClick={() => setShowGallery(true)}
                            className="btn btn-secondary px-5 py-2.5 text-sm flex items-center gap-2"
                        >
                            <Compass size={16} />
                            Explore Examples
                        </button>
                    </div>

                    {/* Drop zone hint */}
                    <div className={`mt-6 transition-all duration-300 ${isDragging ? 'opacity-100 scale-100' : 'opacity-40 scale-95'}`}>
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs border-2 border-dashed transition-colors ${isDragging ? 'border-accent text-accent bg-accent-muted' : 'border-border text-text-tertiary'}`}>
                            <Upload size={14} className={isDragging ? 'animate-bounce' : ''} />
                            {isDragging ? 'Drop your compose file here' : 'or drag & drop .yml / .yaml files'}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Feature Cards ── */}
            <div className="px-6 pb-10 empty-stagger-5">
                <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
                    {features.map(({ id, icon: Icon, title, desc, color }) => (
                        <div
                            key={id}
                            className="feature-card group p-4 rounded-xl surface-raised transition-all duration-200 cursor-default"
                            onMouseEnter={() => setHoveredFeature(id)}
                            onMouseLeave={() => setHoveredFeature(null)}
                            style={{
                                borderLeft: hoveredFeature === id ? `2px solid ${color}` : '2px solid transparent',
                            }}
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors duration-200"
                                style={{
                                    background: hoveredFeature === id ? `${color}20` : 'var(--color-surface-overlay)',
                                    color: hoveredFeature === id ? color : 'var(--color-text-secondary)',
                                }}
                            >
                                <Icon size={16} />
                            </div>
                            <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>
                            <p className="text-xs text-text-secondary leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Examples Gallery Modal ── */}
            <ExamplesGallery
                open={showGallery}
                onClose={() => setShowGallery(false)}
                onSelect={(yaml) => {
                    if (onLoadExample) onLoadExample(yaml);
                    setShowGallery(false);
                }}
            />
        </div>
    );
}
