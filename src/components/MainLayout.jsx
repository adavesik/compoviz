import { lazy, Suspense } from 'react';
import {
    Server, Plus, Download, Upload, Search, Menu, Eye, Code,
    Layers, Undo2, Redo2, Sparkles, GitCompare, PenTool,
    CheckCircle, Globe, Github
} from 'lucide-react';

// Hooks
import { useCompose } from '../hooks/useCompose.jsx';
import { useUI } from '../context/UIContext';
import { useFileImport } from '../hooks/useFileImport.js';
import { useProjectActions } from '../hooks/useProjectActions.js';
import { generateGraphviz } from '../utils/graphviz';
import { serviceTemplates } from '../data/templates';

// UI Components
import { IconButton, useToast } from './ui';

// Feature Components
import { ServiceEditor, NetworkEditor, VolumeEditor, SecretEditor, ConfigEditor } from '../features/editor';
import { ResourceTree } from '../features/sidebar';
import ErrorIndicator from './ErrorIndicator';
import { GraphvizDiagram } from '../features/diagram';
import { CodePreview } from '../features/code-preview';
import { TemplateModal } from './modals';
import CompareView from './CompareView';
import EmptyState from './EmptyState';
import { ProfilesPanel } from '../features/sidebar';
import Footer from './Footer.jsx';
import WhatsNewModal from './WhatsNewModal.jsx';
import { getExample } from '../data/examples.js';

// Lazy load the Visual Builder (React Flow) - only loads when user clicks Build tab
const VisualBuilder = lazy(() => import('./VisualBuilder'));

// Builder loading skeleton
const BuilderSkeleton = () => (
    <div className="builder-skeleton">
        <div className="builder-skeleton-content">
            <Layers size={48} className="builder-skeleton-icon" />
            <p>Loading Visual Builder...</p>
        </div>
    </div>
);

/**
 * MainLayout - The main application layout component
 * Uses context hooks instead of receiving props
 */
export default function MainLayout() {
    // Get data state from ComposeContext
    const { state, dispatch, errors, undo, redo, canUndo, canRedo, handleExport, loadFiles, resetProject } = useCompose();

    // Get UI state from UIContext
    const {
        activeView, sidebarOpen, isMobile, selected, searchTerm,
        showTemplates, codePreviewWidth, isResizing, showMobileCode,
        setActiveView, setSidebarOpen, setSelected, setSearchTerm,
        setShowTemplates, setIsResizing, setShowMobileCode,
    } = useUI();

    // File Import Hook
    const toast = useToast();
    const { isDragging, setIsDragging, collectDroppedFiles, handleImport } = useFileImport(
        loadFiles, setActiveView, isMobile, toast.error
    );

    // Project Actions Hook
    const { handleAdd, handleAddFromTemplate: handleAddFromTemplateBase, handleDelete, handleUpdate, handleClearAll } = useProjectActions(
        dispatch, selected, setSelected, setShowTemplates, resetProject
    );

    // Wrapper to inject serviceTemplates dependency
    const handleAddFromTemplate = (templateName) => handleAddFromTemplateBase(templateName, serviceTemplates);

    // Additional handlers
    const handleExportDiagram = async () => {
        const svg = document.querySelector('.mermaid-container svg');
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'docker-compose-diagram.svg';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleWhatsNewAction = async (action) => {
        if (!action) return;
        switch (action.type) {
            case 'load-example': {
                const exampleYaml = getExample(action.data);
                if (exampleYaml) {
                    await handleImport(exampleYaml);
                    setActiveView('build');
                }
                break;
            }
            default:
                break;
        }
    };

    // Try Demo — loads the profiles example (most visually interesting)
    const handleTryDemo = async () => {
        const exampleYaml = getExample('profiles-demo');
        if (exampleYaml) {
            await handleImport(exampleYaml);
            setActiveView('build');
        }
    };

    // Load example from gallery
    const handleLoadExample = async (yaml, example) => {
        await handleImport(yaml, [], { exampleDir: example?.id || null });
        setActiveView('build');
        toast.success('Example loaded — explore the architecture!');
    };

    // File import handler for EmptyState
    const handleFileImport = async (e) => {
        const files = Array.from(e.target.files || []).filter((file) => (
            file.name.endsWith('.yml') || file.name.endsWith('.yaml') || file.name === '.env'
        ));
        if (files.length === 0) return;
        const primaryFile = files.find((file) => (
            file.name === 'docker-compose.yml' || file.name === 'docker-compose.yaml'
        )) || files[0];
        const orderedFiles = [primaryFile, ...files.filter((file) => file !== primaryFile)];
        const content = await primaryFile.text();
        handleImport(content, orderedFiles);
    };

    // Drop handler for EmptyState
    const handleFileDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = await collectDroppedFiles(e.dataTransfer);
        const files = droppedFiles.filter(({ file }) => (
            file.name.endsWith('.yml') || file.name.endsWith('.yaml') || file.name === '.env'
        )).map(({ file, fullPath }) => {
            if (!fullPath) return file;
            return { name: file.name, webkitRelativePath: fullPath.replace(/^\//, ''), text: () => file.text() };
        });
        if (files.length === 0) return;
        const primaryFile = files.find((file) => (
            file.name === 'docker-compose.yml' || file.name === 'docker-compose.yaml'
        )) || files[0];
        const orderedFiles = [primaryFile, ...files.filter((file) => file !== primaryFile)];
        const content = await primaryFile.text();
        handleImport(content, orderedFiles);
    };

    // Render the appropriate editor based on selection
    const renderEditor = () => {
        if (!selected) return (
            <EmptyState
                onImport={handleFileImport}
                onTryDemo={handleTryDemo}
                onLoadExample={handleLoadExample}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                onDrop={handleFileDrop}
            />
        );

        const { type, name } = selected;
        const item = state[type]?.[name];
        if (!item) return null;

        switch (type) {
            case 'services': return <ServiceEditor name={name} service={item} onUpdate={handleUpdate} allNetworks={state.networks} allServices={state.services} allVolumes={state.volumes} errors={errors} />;
            case 'networks': return <NetworkEditor name={name} network={item} onUpdate={handleUpdate} />;
            case 'volumes': return <VolumeEditor name={name} volume={item} onUpdate={handleUpdate} />;
            case 'secrets': return <SecretEditor name={name} secret={item} onUpdate={handleUpdate} />;
            case 'configs': return <ConfigEditor name={name} config={item} onUpdate={handleUpdate} />;
            default: return null;
        }
    };

    const graphvizDot = generateGraphviz(state);

    return (
        <div className="h-screen flex flex-col overflow-hidden">
            {/* Header */}
            <header className="glass flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-surface-raised rounded-lg lg:hidden">
                        <Menu size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="Compoviz Logo" className="w-8 h-8 rounded-lg object-cover" />
                        <div>
                            <h1 className="text-2xl font-display bg-gradient-to-r from-accent to-secret bg-clip-text text-transparent">Compoviz</h1>
                            <p className="text-[8px] uppercase tracking-[0.2em] text-accent font-semibold leading-none">Visual Architect</p>
                        </div>
                        <a href="https://github.com/adavesik/compoviz" target="_blank" rel="noopener noreferrer"
                            className="ml-2 p-1.5 hover:bg-surface-raised rounded-lg transition-colors opacity-60 hover:opacity-100 hidden sm:flex"
                            title="View on GitHub" aria-label="View on GitHub">
                            <Github size={16} className="text-text-secondary" />
                        </a>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="undo-redo-group flex gap-1 glass rounded-lg p-1 mr-2">
                        <IconButton icon={Undo2} onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo} />
                        <IconButton icon={Redo2} onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} />
                    </div>
                    <div className="header-search relative hidden md:block">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                        <input type="text" placeholder="Search resources..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 w-48 lg:w-64 text-sm" />
                    </div>
                    <ErrorIndicator errors={errors} onSelect={setSelected} />
                    <div className="header-view-buttons flex gap-1 glass rounded-lg p-1">
                        <button onClick={() => setActiveView('editor')} className={`px-2 md:px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${activeView === 'editor' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text'}`}><Code size={14} /><span className="view-btn-text hidden md:inline">Editor</span></button>
                        <button onClick={() => setActiveView('build')} className={`px-2 md:px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${activeView === 'build' ? 'bg-success text-white' : 'text-text-secondary hover:text-text'}`}><PenTool size={14} /><span className="view-btn-text hidden md:inline">Build</span></button>
                        <button onClick={() => setActiveView('diagram')} className={`px-2 md:px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${activeView === 'diagram' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text'}`}><Eye size={14} /><span className="view-btn-text hidden md:inline">View</span></button>
                        <button onClick={() => setActiveView('compare')} className={`px-2 md:px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${activeView === 'compare' ? 'bg-secret text-white' : 'text-text-secondary hover:text-text'}`}><GitCompare size={14} /><span className="view-btn-text hidden md:inline">Compare</span></button>
                    </div>
                    {activeView === 'diagram' && <IconButton icon={Download} onClick={handleExportDiagram} title="Export Diagram" />}
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {activeView !== 'compare' && isMobile && sidebarOpen && (
                    <div className="mobile-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
                )}

                <aside className={`
                    ${activeView === 'compare' ? 'hidden' : ''}
                    ${isMobile ? 'sidebar-mobile' : ''}
                    ${isMobile && sidebarOpen ? 'open' : ''}
                    ${!isMobile && sidebarOpen ? 'w-64' : ''}
                    ${!isMobile && !sidebarOpen ? 'w-0' : ''}
                    transition-all duration-300 overflow-hidden border-r border-border/50 glass-light flex flex-col
                `}>
                    <div className="p-3 border-b border-border/50 space-y-2">
                        <input type="text" placeholder="Project name..." value={state.name || ''}
                            onChange={e => dispatch({ type: 'SET_STATE', payload: { ...state, name: e.target.value } })}
                            className="w-full text-sm" />
                        <button onClick={() => handleAdd('services')} className="btn btn-primary w-full flex items-center justify-center gap-2"><Plus size={16} />Add Service</button>
                        <button onClick={() => setShowTemplates(true)} className="btn btn-secondary w-full flex items-center justify-center gap-2"><Sparkles size={16} />From Template</button>
                    </div>
                    <div className="p-2 border-b border-border/50">
                        <ProfilesPanel />
                    </div>
                    <div className="flex-1 overflow-auto p-2">
                        <ResourceTree onSelect={(sel) => { setSelected(sel); if (isMobile) setSidebarOpen(false); }} onAdd={handleAdd} onDelete={handleDelete} />
                    </div>
                    <div className="px-3 py-2 border-t border-border/50">
                        <a href="https://docs.docker.com/reference/compose-file/" target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised/50 hover:bg-accent/20 transition-colors group">
                            <CheckCircle size={12} className="text-success" />
                            <span className="text-xs text-text-secondary group-hover:text-accent transition-colors">Compose Spec v2.x</span>
                            <Globe size={10} className="text-text-secondary group-hover:text-accent" />
                        </a>
                    </div>
                    <div className="p-3 border-t border-border/50">
                        <button onClick={handleClearAll} className="w-full text-xs text-text-secondary hover:text-error transition-colors">Clear All</button>
                    </div>
                </aside>

                <main className="flex-1 flex overflow-hidden">
                    {activeView === 'compare' ? (
                        <CompareView />
                    ) : activeView === 'build' ? (
                        <div className="flex-1 p-4">
                            <div className="h-full glass rounded-xl overflow-hidden">
                                <Suspense fallback={<BuilderSkeleton />}><VisualBuilder /></Suspense>
                            </div>
                        </div>
                    ) : activeView === 'editor' ? (
                        <>
                            <div className="flex-1 overflow-auto p-6">{renderEditor()}</div>
                            <div className={`hidden xl:flex w-1 cursor-col-resize bg-border/30 hover:bg-accent/50 transition-colors relative group ${isResizing ? 'bg-accent/70' : ''}`}
                                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-1 h-1 rounded-full bg-accent"></div>
                                    <div className="w-1 h-1 rounded-full bg-accent"></div>
                                    <div className="w-1 h-1 rounded-full bg-accent"></div>
                                </div>
                            </div>
                            <div className="border-l border-border/50 glass-light hidden xl:flex flex-col" style={{ width: codePreviewWidth }}>
                                <CodePreview />
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 p-4">
                            <div className="h-full glass rounded-xl overflow-hidden">
                                <GraphvizDiagram dot={graphvizDot} onNodeClick={setSelected} onAdd={handleAdd} />
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Footer */}
            {activeView !== 'compare' && <Footer />}

            {/* Mobile YAML Toggle */}
            <div className="xl:hidden fixed bottom-4 right-4 flex gap-2">
                <button onClick={() => setShowMobileCode(true)} className="btn btn-secondary shadow-lg glass"><Code size={18} className="mr-2" />View Code</button>
                <button onClick={handleExport} className="btn btn-primary shadow-lg glow"><Download size={18} /></button>
            </div>

            {/* Mobile Code Modal */}
            {showMobileCode && (
                <div className="fixed inset-0 z-50 flex flex-col bg-bg">
                    <div className="flex items-center justify-between p-4 border-b border-border/50 glass">
                        <h2 className="text-lg font-semibold">Docker Compose YAML</h2>
                        <div className="flex gap-2">
                            <button onClick={handleExport} className="btn btn-primary text-sm py-1.5"><Download size={16} className="mr-1" />Export</button>
                            <button onClick={() => setShowMobileCode(false)} className="text-accent font-medium">Done</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto"><CodePreview /></div>
                </div>
            )}

            <WhatsNewModal onAction={handleWhatsNewAction} />
            {showTemplates && <TemplateModal onSelect={handleAddFromTemplate} onClose={() => setShowTemplates(false)} />}
        </div>
    );
}
