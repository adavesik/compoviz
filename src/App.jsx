import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Server, Plus, Download, Upload, Search, Menu, Eye, Code,
  Layers, Undo2, Redo2, Sparkles, GitCompare, PenTool,
  CheckCircle, Globe
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

// Utilities and Hooks
import { generateYaml, parseYaml } from './utils/yaml';
import { validateState } from './utils/validation';
import { generateGraphviz } from './utils/graphviz';
import { ComposeContext, composeReducer, initialState } from './hooks/useCompose';
import { useHistoryReducer } from './hooks/useHistory';
import { serviceTemplates } from './data/templates';

// UI Components
import { IconButton } from './components/ui';

// Feature Components
import { ServiceEditor, NetworkEditor, VolumeEditor, SecretEditor, ConfigEditor } from './features/editor';
import { ResourceTree, IssuesPanel } from './features/sidebar';
import { GraphvizDiagram } from './features/diagram';
import { CodePreview } from './features/code-preview';
import { TemplateModal } from './components/modals';
import CompareView from './components/CompareView';

// Lazy load the Visual Builder (React Flow) - only loads when user clicks Build tab
const VisualBuilder = lazy(() => import('./components/VisualBuilder'));

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
 * Main Application Component
 * Handles global state, routing between views, and coordination
 */
export default function App() {
  // Use history-enabled reducer for undo/redo
  const { state, dispatch, undo, redo, canUndo, canRedo } = useHistoryReducer(composeReducer, initialState);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('editor'); // 'editor' | 'diagram' | 'build' | 'compare'
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [yamlCode, setYamlCode] = useState('');
  const [errors, setErrors] = useState([]);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile when resizing down
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMobileCode, setShowMobileCode] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('docker-compose-state');
    if (saved) {
      try {
        dispatch({ type: 'SET_STATE', payload: JSON.parse(saved) });
      } catch {
        // Silence loading errors
      }
    }
  }, [dispatch]);

  // Save to localStorage and generate YAML
  useEffect(() => {
    localStorage.setItem('docker-compose-state', JSON.stringify(state));
    setYamlCode(generateYaml(state));
    setErrors(validateState(state));
  }, [state]);

  // Handlers
  const handleAdd = (type) => {
    const name = prompt(`Enter ${type.slice(0, -1)} name:`);
    if (name?.trim()) {
      dispatch({ type: `ADD_${type.slice(0, -1).toUpperCase()}`, name: name.trim() });
      setSelected({ type, name: name.trim() });
    }
  };

  const handleAddFromTemplate = (templateName) => {
    const template = serviceTemplates[templateName];
    if (!template) return;

    const serviceName = template.name || templateName;
    dispatch({ type: 'ADD_SERVICE', name: serviceName });
    dispatch({ type: 'UPDATE_SERVICE', name: serviceName, data: template.config });

    // Add suggested volume if exists
    if (template.suggestedVolume) {
      dispatch({ type: 'ADD_VOLUME', name: template.suggestedVolume.name });
      if (template.suggestedVolume.config) {
        dispatch({ type: 'UPDATE_VOLUME', name: template.suggestedVolume.name, data: template.suggestedVolume.config });
      }
    }

    setSelected({ type: 'services', name: serviceName });
    setShowTemplates(false);
  };

  const handleDelete = (type, name) => {
    if (confirm(`Delete ${name}?`)) {
      dispatch({ type: `DELETE_${type.slice(0, -1).toUpperCase()}`, name });
      if (selected?.name === name) setSelected(null);
    }
  };

  const handleUpdate = useCallback((data) => {
    if (!selected) return;
    dispatch({ type: `UPDATE_${selected.type.slice(0, -1).toUpperCase()}`, name: selected.name, data });
  }, [selected, dispatch]);

  const handleYamlChange = (newYaml) => {
    const parsed = parseYaml(newYaml);
    dispatch({ type: 'SET_STATE', payload: parsed });
  };

  const handleExport = () => {
    const blob = new Blob([yamlCode], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'docker-compose.yml'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (content) => {
    try {
      const parsed = parseYaml(content);
      dispatch({ type: 'SET_STATE', payload: parsed });
      // On mobile, switch to diagram mode to show the imported config visualized
      if (isMobile) {
        setView('diagram');
      }
    } catch (e) { alert('Invalid YAML: ' + e.message); }
  };

  const handleExportDiagram = async () => {
    const svg = document.querySelector('.mermaid-container svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'docker-compose-diagram.svg'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all configuration? This cannot be undone.')) {
      dispatch({ type: 'SET_STATE', payload: initialState });
      setSelected(null);
    }
  };

  // Render the appropriate editor based on selection
  const renderEditor = () => {
    if (!selected) return (
      <div
        className={`h-full flex flex-col items-center justify-center text-cyber-text-muted border-2 border-dashed rounded-xl transition-all duration-300 m-4 ${isDragging ? 'border-cyber-accent bg-cyber-accent/5' : 'border-transparent'}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && (file.name.endsWith('.yml') || file.name.endsWith('.yaml'))) {
            const reader = new FileReader();
            reader.onload = (e) => handleImport(e.target?.result);
            reader.readAsText(file);
          }
        }}
      >
        <Layers size={48} className={`mb-4 transition-all duration-300 ${isDragging ? 'text-cyber-accent scale-110' : 'opacity-50'}`} />
        <p className="text-lg mb-2 font-medium">Select a resource to edit</p>
        <p className="text-sm mb-8">Or add a new service, network, or volume</p>

        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className={`p-6 rounded-xl glass transition-all duration-300 ${isDragging ? 'border-cyber-accent shadow-glow' : 'border border-cyber-border/30'}`}>
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <Upload size={32} className={`transition-colors duration-300 ${isDragging ? 'text-cyber-accent animate-bounce' : 'text-cyber-text-muted'}`} />
              <p className="text-sm font-medium">Drag & drop docker-compose.yml</p>
              <span className="text-xs text-cyber-text-muted">Supports .yml and .yaml</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full">
            <div className="h-px bg-cyber-border/50 flex-1"></div>
            <span className="text-xs text-cyber-text-muted uppercase tracking-wider">or</span>
            <div className="h-px bg-cyber-border/50 flex-1"></div>
          </div>

          <label className="btn btn-secondary cursor-pointer gap-2 flex items-center px-6 hover:bg-cyber-surface-light transition-all">
            <Upload size={16} />
            <span>Import File</span>
            <input
              type="file"
              accept=".yml,.yaml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (e) => handleImport(e.target?.result);
                  reader.readAsText(file);
                }
              }}
            />
          </label>
        </div>
      </div>
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
    <ComposeContext.Provider value={{ state, dispatch }}>
      <div className="h-screen flex flex-col overflow-hidden">
        <Analytics />

        {/* Header */}
        <header className="glass flex items-center justify-between px-4 py-3 border-b border-cyber-border/50">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-cyber-surface-light rounded-lg lg:hidden">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Compoviz Logo" className="w-8 h-8 rounded-lg object-cover" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyber-accent to-cyber-purple bg-clip-text text-transparent">Compoviz</h1>
                <p className="text-[8px] uppercase tracking-[0.2em] text-cyber-accent font-semibold leading-none">Visual Architect</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo/Redo buttons - hidden on mobile */}
            <div className="undo-redo-group flex gap-1 glass rounded-lg p-1 mr-2">
              <IconButton icon={Undo2} onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo} />
              <IconButton icon={Redo2} onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} />
            </div>
            {/* Search - hidden on mobile */}
            <div className="header-search relative hidden md:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-text-muted" />
              <input type="text" placeholder="Search resources..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 w-48 lg:w-64 text-sm" />
            </div>
            {/* View switcher - icons only on mobile */}
            <div className="header-view-buttons flex gap-1 glass rounded-lg p-1">
              <button onClick={() => setView('editor')} className={`px-2 md:px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${view === 'editor' ? 'bg-cyber-accent text-white' : 'text-cyber-text-muted hover:text-cyber-text'}`}><Code size={14} /><span className="view-btn-text hidden md:inline">Editor</span></button>
              <button onClick={() => setView('build')} className={`px-2 md:px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${view === 'build' ? 'bg-cyber-success text-white' : 'text-cyber-text-muted hover:text-cyber-text'}`}><PenTool size={14} /><span className="view-btn-text hidden md:inline">Build</span></button>
              <button onClick={() => setView('diagram')} className={`px-2 md:px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${view === 'diagram' ? 'bg-cyber-accent text-white' : 'text-cyber-text-muted hover:text-cyber-text'}`}><Eye size={14} /><span className="view-btn-text hidden md:inline">View</span></button>
              <button onClick={() => setView('compare')} className={`px-2 md:px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1 ${view === 'compare' ? 'bg-cyber-purple text-white' : 'text-cyber-text-muted hover:text-cyber-text'}`}><GitCompare size={14} /><span className="view-btn-text hidden md:inline">Compare</span></button>
            </div>
            {view === 'diagram' && <IconButton icon={Download} onClick={handleExportDiagram} title="Export Diagram" />}
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile sidebar overlay */}
          {isMobile && sidebarOpen && (
            <div
              className="mobile-sidebar-overlay"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Left Sidebar - overlay on mobile, inline on desktop */}
          <aside className={`
            ${isMobile ? 'sidebar-mobile' : ''}
            ${isMobile && sidebarOpen ? 'open' : ''}
            ${!isMobile && sidebarOpen ? 'w-64' : ''}
            ${!isMobile && !sidebarOpen ? 'w-0' : ''}
            transition-all duration-300 overflow-hidden border-r border-cyber-border/50 glass-light flex flex-col
          `}>
            <div className="p-3 border-b border-cyber-border/50 space-y-2">
              <input
                type="text"
                placeholder="Project name..."
                value={state.name || ''}
                onChange={e => dispatch({ type: 'SET_STATE', payload: { ...state, name: e.target.value } })}
                className="w-full text-sm"
              />
              <button onClick={() => handleAdd('services')} className="btn btn-primary w-full flex items-center justify-center gap-2"><Plus size={16} />Add Service</button>
              <button onClick={() => setShowTemplates(true)} className="btn btn-secondary w-full flex items-center justify-center gap-2"><Sparkles size={16} />From Template</button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <ResourceTree state={state} selected={selected} onSelect={(sel) => { setSelected(sel); if (isMobile) setSidebarOpen(false); }} onAdd={handleAdd} onDelete={handleDelete} errors={errors} searchTerm={searchTerm} />
            </div>
            <IssuesPanel errors={errors} onSelect={(sel) => { setSelected(sel); if (isMobile) setSidebarOpen(false); }} />
            {/* Spec Compliance Badge */}
            <div className="px-3 py-2 border-t border-cyber-border/50">
              <a
                href="https://docs.docker.com/reference/compose-file/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-surface-light/50 hover:bg-cyber-accent/20 transition-colors group"
              >
                <CheckCircle size={12} className="text-cyber-success" />
                <span className="text-xs text-cyber-text-muted group-hover:text-cyber-accent transition-colors">
                  Compose Spec v2.x
                </span>
                <Globe size={10} className="text-cyber-text-muted group-hover:text-cyber-accent" />
              </a>
            </div>
            <div className="p-3 border-t border-cyber-border/50">
              <button onClick={handleClearAll} className="w-full text-xs text-cyber-text-muted hover:text-cyber-error transition-colors">Clear All</button>
            </div>
          </aside>

          {/* Main Panel */}
          <main className="flex-1 flex overflow-hidden">
            {view === 'compare' ? (
              /* Compare View - Takes full width */
              <CompareView />
            ) : view === 'build' ? (
              /* Build View - Visual drag-and-drop builder with React Flow */
              <div className="flex-1 p-4">
                <div className="h-full glass rounded-xl overflow-hidden">
                  <Suspense fallback={<BuilderSkeleton />}>
                    <VisualBuilder
                      state={state}
                      dispatch={dispatch}
                      onSelectNode={setSelected}
                      errors={errors}
                    />
                  </Suspense>
                </div>
              </div>
            ) : view === 'editor' ? (
              <>
                {/* Editor Panel */}
                <div className="flex-1 overflow-auto p-6">{renderEditor()}</div>
                {/* Code Preview Panel */}
                <div className="w-96 border-l border-cyber-border/50 glass-light hidden xl:flex flex-col">
                  <CodePreview yaml={yamlCode} onYamlChange={handleYamlChange} onExport={handleExport} onImport={handleImport} />
                </div>
              </>
            ) : (
              /* Diagram View (Mermaid - read-only) */
              <div className="flex-1 p-4">
                <div className="h-full glass rounded-xl overflow-hidden">
                  <GraphvizDiagram dot={graphvizDot} onNodeClick={setSelected} onAdd={handleAdd} />
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Mobile YAML Toggle - View Code button */}
        <div className="xl:hidden fixed bottom-4 right-4 flex gap-2">
          <button onClick={() => setShowMobileCode(true)} className="btn btn-secondary shadow-lg glass"><Code size={18} className="mr-2" />View Code</button>
          <button onClick={handleExport} className="btn btn-primary shadow-lg glow"><Download size={18} /></button>
        </div>
      </div>

      {/* Mobile Code Modal */}
      {showMobileCode && (
        <div className="fixed inset-0 z-50 flex flex-col bg-cyber-bg">
          <div className="flex items-center justify-between p-4 border-b border-cyber-border/50 glass">
            <h2 className="text-lg font-semibold">Docker Compose YAML</h2>
            <div className="flex gap-2">
              <button onClick={handleExport} className="btn btn-primary text-sm py-1.5"><Download size={16} className="mr-1" />Export</button>
              <button onClick={() => setShowMobileCode(false)} className="text-cyber-accent font-medium">Done</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <CodePreview yaml={yamlCode} onYamlChange={handleYamlChange} onExport={handleExport} onImport={handleImport} />
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplates && <TemplateModal onSelect={handleAddFromTemplate} onClose={() => setShowTemplates(false)} />}
    </ComposeContext.Provider>
  );
}
