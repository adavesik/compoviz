import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Compass, ExternalLink, Info, Globe, Package, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { galleryExamples, CATEGORIES } from '../data/examplesGallery';
import { fetchRemoteExamplesList, fetchRemoteExampleYaml, fetchRemoteExampleDescription } from '../utils/githubExamples';
import ExampleCard from './ExampleCard';

/**
 * ExamplesGallery — Modal that displays Docker Compose examples.
 * Two sources:
 *   1. "Curated" tab — 8 static bundled examples (instant, no network)
 *   2. "Browse All" tab — full awesome-compose repo fetched on-demand from GitHub
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the gallery is visible
 * @param {function} props.onClose - Callback to close the gallery
 * @param {function} props.onSelect - Callback when an example is chosen: (yamlString, example) => void
 */
export default function ExamplesGallery({ open, onClose, onSelect }) {
    const [activeTab, setActiveTab] = useState('curated'); // 'curated' | 'browse'
    const [activeCategory, setActiveCategory] = useState('all');

    // Remote examples state
    const [remoteExamples, setRemoteExamples] = useState([]);
    const [remoteLoading, setRemoteLoading] = useState(false);
    const [remoteError, setRemoteError] = useState(null);
    const [fetchingYaml, setFetchingYaml] = useState(null); // id of example being fetched
    const [searchTerm, setSearchTerm] = useState('');

    const modalRef = useRef(null);
    const closeButtonRef = useRef(null);

    const filteredExamples = activeCategory === 'all'
        ? galleryExamples.filter(e => !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.tags.some(t => t.includes(searchTerm.toLowerCase())))
        : galleryExamples.filter(e => e.category === activeCategory && (!searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.tags.some(t => t.includes(searchTerm.toLowerCase()))));

    // Filter remote examples by search
    const filteredRemote = searchTerm
        ? remoteExamples.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.id.includes(searchTerm.toLowerCase()))
        : remoteExamples;

    // Fetch remote listing when "Browse All" tab is activated
    useEffect(() => {
        if (activeTab === 'browse' && remoteExamples.length === 0 && !remoteLoading) {
            loadRemoteExamples();
        }
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadRemoteExamples = async () => {
        setRemoteLoading(true);
        setRemoteError(null);
        try {
            const examples = await fetchRemoteExamplesList();
            setRemoteExamples(examples);
        } catch (err) {
            setRemoteError(err.message);
        } finally {
            setRemoteLoading(false);
        }
    };

    // Handle keyboard events (Escape to close)
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    // Focus management
    useEffect(() => {
        if (open) {
            closeButtonRef.current?.focus();
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, handleKeyDown]);

    // Handle backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Handle curated example selection (instant — YAML is bundled)
    const handleCuratedSelect = (example) => {
        onSelect(example.yaml, example);
    };

    // Handle remote example selection (fetch YAML on-demand)
    const handleRemoteSelect = async (example) => {
        setFetchingYaml(example.id);
        setRemoteError(null);
        try {
            const yaml = await fetchRemoteExampleYaml(example.id);
            onSelect(yaml, { ...example, yaml });
        } catch (err) {
            setRemoteError(`Failed to load "${example.name}": ${err.message}`);
        } finally {
            setFetchingYaml(null);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="examples-gallery-title"
        >
            <div
                ref={modalRef}
                className="glass rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col modal-content"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 pb-0">
                    <div className="flex items-center gap-2">
                        <Compass size={20} className="text-accent" />
                        <h2 id="examples-gallery-title" className="text-lg font-bold text-text">
                            Explore Examples
                        </h2>
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className="p-2 hover:bg-surface-raised rounded-lg transition-colors text-text-secondary hover:text-text"
                        aria-label="Close gallery"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Disclaimer */}
                <div className="px-5 pt-3">
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-accent-muted/50 border border-accent/20">
                        <Info size={14} className="text-accent mt-0.5 shrink-0" />
                        <p className="text-xs text-text-secondary leading-relaxed">
                            These examples are for <strong className="text-text">visualization only</strong>.
                            Select one to explore its architecture as an interactive diagram.
                            <span className="ml-1 text-text-tertiary">
                                Sourced from{' '}
                                <a
                                    href="https://github.com/docker/awesome-compose"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent hover:underline inline-flex items-center gap-0.5"
                                >
                                    awesome-compose
                                    <ExternalLink size={10} />
                                </a>
                            </span>
                        </p>
                    </div>
                </div>

                {/* Source Tabs: Curated vs Browse All */}
                <div className="px-5 pt-4 pb-2">
                    <div className="flex gap-1 p-1 bg-surface-raised rounded-lg w-fit">
                        <button
                            onClick={() => setActiveTab('curated')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                                activeTab === 'curated'
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-text-secondary hover:text-text'
                            }`}
                        >
                            <Package size={12} />
                            Curated
                        </button>
                        <button
                            onClick={() => setActiveTab('browse')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                                activeTab === 'browse'
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-text-secondary hover:text-text'
                            }`}
                        >
                            <Globe size={12} />
                            Browse All
                            {remoteExamples.length > 0 && (
                                <span className="text-[10px] opacity-75">({remoteExamples.length})</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'curated' ? (
                    <>
                        {/* Category Filter + Search (curated) */}
                        <div className="px-5 pb-2 space-y-2">
                            <input
                                type="text"
                                placeholder="Search curated examples..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-surface-raised border border-border/50 focus:border-accent/50 focus:outline-none text-text placeholder:text-text-tertiary"
                            />
                            <div className="flex gap-1.5 flex-wrap" role="tablist" aria-label="Filter by category">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        role="tab"
                                        aria-selected={activeCategory === cat}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                                            activeCategory === cat
                                                ? 'bg-accent text-white'
                                                : 'bg-surface-raised text-text-secondary hover:text-text hover:bg-surface-overlay'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Curated Examples Grid */}
                        <div className="flex-1 overflow-auto px-5 pb-5 pt-2" role="tabpanel">
                            {filteredExamples.length === 0 ? (
                                <EmptyFilterState />
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {filteredExamples.map(example => (
                                        <ExampleCard
                                            key={example.id}
                                            example={example}
                                            onSelect={handleCuratedSelect}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Search (browse tab) */}
                        <div className="px-5 pb-2">
                            <input
                                type="text"
                                placeholder="Search examples..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg bg-surface-raised border border-border/50 focus:border-accent/50 focus:outline-none text-text placeholder:text-text-tertiary"
                            />
                        </div>

                        {/* Remote Examples List */}
                        <div className="flex-1 overflow-auto px-5 pb-5 pt-2">
                            {remoteLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Loader2 size={24} className="text-accent animate-spin mb-3" />
                                    <p className="text-sm text-text-secondary">Loading examples from GitHub...</p>
                                </div>
                            ) : remoteError ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <AlertCircle size={24} className="text-error mb-3" />
                                    <p className="text-sm text-text-secondary mb-3">{remoteError}</p>
                                    <button
                                        onClick={loadRemoteExamples}
                                        className="btn btn-secondary text-xs flex items-center gap-1.5"
                                    >
                                        <RefreshCw size={12} />
                                        Retry
                                    </button>
                                </div>
                            ) : filteredRemote.length === 0 ? (
                                <EmptyFilterState />
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {filteredRemote.map(example => (
                                        <RemoteExampleItem
                                            key={example.id}
                                            example={example}
                                            onSelect={handleRemoteSelect}
                                            isLoading={fetchingYaml === example.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * RemoteExampleItem — Compact card for remote (on-demand) examples.
 * Shows a loading spinner when its YAML is being fetched.
 * Fetches description from README on hover for richer display.
 */
function RemoteExampleItem({ example, onSelect, isLoading }) {
    const [description, setDescription] = useState(null);
    const hasFetched = useRef(false);

    const handleMouseEnter = async () => {
        if (hasFetched.current || description) return;
        hasFetched.current = true;
        try {
            const desc = await fetchRemoteExampleDescription(example.id);
            if (desc) setDescription(desc);
        } catch {
            // Silently fail — description is optional
        }
    };

    return (
        <button
            onClick={() => !isLoading && onSelect(example)}
            onMouseEnter={handleMouseEnter}
            disabled={isLoading}
            className="group p-3 rounded-lg surface-raised text-left transition-all duration-150 hover:bg-surface-overlay border border-transparent hover:border-accent/30 w-full disabled:opacity-60 disabled:cursor-wait flex items-center gap-3"
        >
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text group-hover:text-accent transition-colors truncate">
                    {example.name}
                </p>
                {description ? (
                    <p className="text-[11px] text-text-secondary truncate mt-0.5 leading-relaxed">
                        {description}
                    </p>
                ) : (
                    <p className="text-[11px] text-text-tertiary truncate mt-0.5">
                        {example.id}
                    </p>
                )}
            </div>
            {isLoading ? (
                <Loader2 size={14} className="text-accent animate-spin shrink-0" />
            ) : (
                <Globe size={12} className="text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
        </button>
    );
}

/**
 * Empty state shown when no examples match the current filter/search.
 */
function EmptyFilterState() {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <Compass size={32} className="text-text-tertiary mb-3" />
            <p className="text-sm text-text-secondary">No examples match your search.</p>
        </div>
    );
}
