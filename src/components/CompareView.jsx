import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Upload, Trash2, ZoomIn, ZoomOut, Maximize, AlertTriangle, Info, XCircle, Plus, Undo2, Redo2,
    Download, ImageDown, ClipboardPaste, FileCode2, ChevronDown, Pencil, RotateCcw, Copy, Focus,
    Search, Eye, EyeOff, Sparkles, Box, ExternalLink, Layers, Keyboard,
} from 'lucide-react';
import { useMultiProject } from '../hooks/useMultiProject';
import { useCompose } from '../hooks/useCompose';
import { useUI } from '../context/UIContext';
import { compareProjects } from '../utils/comparison';
import { getFixProposals } from '../utils/conflictResolver';
import { generateYaml } from '../utils/yaml';
import { useToast } from './ui';
import CompareDiagram from '../features/compare/CompareDiagram';
import ResultsPanel from '../features/compare/ResultsPanel';
import InspectorPanel from '../features/compare/InspectorPanel';
import { FloatingMenu, HoverCard, PasteYamlModal } from '../features/compare/CompareOverlays';
import { SEVERITY_META, downloadText, isSameSelection, projectColor } from '../features/compare/compareUi';

const LEFT_PANEL_INSET = 16 + 320 + 16;
const RIGHT_PANEL_INSET = 16 + 384 + 16;

const isYamlFile = (f) => /\.ya?ml$/i.test(f.name);
const isTypingTarget = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/** Project chip in the toolbar with its own action menu. */
function ProjectChip({ project, color, issueCount, onOpenMenu, onSelect, active }) {
    return (
        <div className={`group flex items-center rounded-lg border transition-all ${active ? 'border-accent bg-accent/10' : 'border-border/70 hover:border-text-secondary'} bg-black/20`}>
            <button type="button" onClick={onSelect} className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 text-sm" title={`Inspect ${project.name}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
                <span className="font-medium truncate max-w-[140px]">{project.name}</span>
                {project.modified && <span className="w-1.5 h-1.5 rounded-full bg-accent" title="Modified by applied fixes" aria-label="modified" />}
                {issueCount > 0 && <span className="px-1.5 rounded-full bg-error/80 text-white text-[10px] font-bold">{issueCount}</span>}
            </button>
            <button type="button" onClick={onOpenMenu} className="px-1.5 py-1.5 text-text-secondary hover:text-text border-l border-border/50" aria-label={`Actions for ${project.name}`} aria-haspopup="menu">
                <ChevronDown size={14} />
            </button>
        </div>
    );
}

function EmptyState({ projectCount, maxProjects, onUpload, onPaste, onUseEditor, editorHasServices }) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="max-w-xl w-full text-center space-y-6">
                <div className="relative group mx-auto w-24 h-24 mb-6">
                    <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl group-hover:bg-accent/40 transition-all animate-pulse" />
                    <div className="relative flex items-center justify-center w-full h-full glass rounded-full border border-accent/30 group-hover:border-accent transition-all">
                        <Upload size={40} className="text-accent" />
                    </div>
                </div>
                <div>
                    <h1 className="text-3xl font-bold mb-3 tracking-tight">Compare Projects</h1>
                    <p className="text-text-secondary text-lg">
                        {projectCount === 0
                            ? `Drop up to ${maxProjects} Docker Compose files to find out whether they can run side by side on one host.`
                            : 'Add one more compose file to start the comparison.'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button type="button" onClick={onUpload} className="px-6 py-3 bg-accent text-black rounded-2xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-accent/20 flex items-center gap-2">
                        <Upload size={16} /> Choose files
                    </button>
                    <button type="button" onClick={onPaste} className="px-5 py-3 rounded-2xl border border-border hover:border-accent font-semibold flex items-center gap-2 transition-colors">
                        <ClipboardPaste size={16} /> Paste YAML
                    </button>
                    <button type="button" onClick={onUseEditor} disabled={!editorHasServices} className="px-5 py-3 rounded-2xl border border-border hover:border-accent font-semibold flex items-center gap-2 transition-colors disabled:opacity-40 disabled:pointer-events-none" title={editorHasServices ? 'Add the project open in the editor' : 'The editor project has no services'}>
                        <FileCode2 size={16} /> Use editor project
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-3 text-left">
                    <div className="p-4 glass rounded-2xl border border-border/50">
                        <AlertTriangle className="text-warning mb-2" size={18} />
                        <h3 className="font-semibold text-sm">Detect</h3>
                        <p className="text-xs text-text-secondary mt-1">Host ports, container names, project names, bind mounts, networks.</p>
                    </div>
                    <div className="p-4 glass rounded-2xl border border-border/50">
                        <Sparkles className="text-accent mb-2" size={18} />
                        <h3 className="font-semibold text-sm">Resolve</h3>
                        <p className="text-xs text-text-secondary mt-1">One-click fixes with a preview of every change, plus undo.</p>
                    </div>
                    <div className="p-4 glass rounded-2xl border border-border/50">
                        <Download className="text-success mb-2" size={18} />
                        <h3 className="font-semibold text-sm">Export</h3>
                        <p className="text-xs text-text-secondary mt-1">Download fixed compose files or open them in the editor.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

const SHORTCUTS = [
    ['Click', 'Inspect service / issue'],
    ['Right-click', 'Actions & quick fixes'],
    ['J / K', 'Next / previous issue'],
    ['F', 'Fit diagram'],
    ['+ / −', 'Zoom'],
    ['Esc', 'Clear selection'],
    ['Ctrl+Z / Ctrl+Y', 'Undo / redo fix'],
];

// Main Compare View Component
function CompareView() {
    const {
        projects,
        addProject,
        addProjectFromState,
        removeProject,
        renameProject,
        resetProject,
        applyFix,
        clearAllProjects,
        undo,
        redo,
        canUndo,
        canRedo,
        dismissed,
        toggleDismissed,
        maxProjects,
    } = useMultiProject();
    const { state: editorState, loadFiles } = useCompose();
    const { setActiveView } = useUI();
    const toast = useToast();

    const fileInputRef = useRef(null);
    const diagramRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [rawSelection, setSelectionState] = useState(null);
    const [hover, setHover] = useState(null);
    const [menu, setMenu] = useState(null); // { x, y, items, label }
    const [pasteOpen, setPasteOpen] = useState(false);
    const [panelCollapsed, setPanelCollapsed] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [zoom, setZoom] = useState(1);
    const dragDepth = useRef(0);

    const ready = projects.length >= 2;

    const results = useMemo(() => (ready ? compareProjects(projects) : []), [projects, ready]);
    const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);
    const activeResults = useMemo(() => results.filter(r => !dismissedSet.has(r.id)), [results, dismissedSet]);

    const proposalsById = useMemo(
        () => new Map(results.map(r => [r.id, getFixProposals(r, projects)])),
        [results, projects]
    );
    const proposalsFor = useCallback((result) => proposalsById.get(result.id) || [], [proposalsById]);
    const fixCounts = useMemo(
        () => new Map([...proposalsById].map(([id, list]) => [id, list.length])),
        [proposalsById]
    );

    const issueCountByProject = useMemo(() => {
        const counts = new Map();
        activeResults.filter(r => r.severity !== 'info').forEach(r => r.projectIds?.forEach(id => counts.set(id, (counts.get(id) || 0) + 1)));
        return counts;
    }, [activeResults]);

    // Ignore selections that point at removed projects
    const selection = useMemo(() => {
        if (!rawSelection) return null;
        if ((rawSelection.type === 'service' || rawSelection.type === 'project')
            && !projects.some(p => p.id === rawSelection.projectId)) return null;
        return rawSelection;
    }, [rawSelection, projects]);

    const select = useCallback((next, { focus = false } = {}) => {
        setSelectionState(prev => (next && isSameSelection(prev, next) && !focus ? prev : next));
        if (next && focus) requestAnimationFrame(() => diagramRef.current?.focusSelection(next));
    }, []);

    const getInsets = useCallback(() => ({
        left: ready && !panelCollapsed ? LEFT_PANEL_INSET : 0,
        right: selection ? RIGHT_PANEL_INSET : 0,
        top: 0,
        bottom: 0,
    }), [ready, panelCollapsed, selection]);

    // ── File loading ──
    const readFiles = useCallback((files) => {
        const yamlFiles = files.filter(isYamlFile);
        if (yamlFiles.length === 0) {
            if (files.length > 0) toast.warning('Only .yml / .yaml files can be compared.');
            return;
        }
        const room = maxProjects - projects.length;
        if (room <= 0) {
            toast.warning(`Maximum of ${maxProjects} projects. Remove one first.`);
            return;
        }
        if (yamlFiles.length > room) toast.info(`Only the first ${room} file${room === 1 ? '' : 's'} added (limit ${maxProjects}).`);
        yamlFiles.slice(0, room).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = addProject(event.target?.result, file.name);
                if (!result.success) toast.error(`Failed to add ${file.name}: ${result.error}`);
            };
            reader.onerror = () => toast.error(`Could not read ${file.name}`);
            reader.readAsText(file);
        });
    }, [addProject, maxProjects, projects.length, toast]);

    const handleFileSelect = (e) => {
        readFiles(Array.from(e.target.files || []));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragEnter = (e) => {
        if (!e.dataTransfer?.types?.includes('Files')) return;
        e.preventDefault();
        dragDepth.current += 1;
        setIsDragging(true);
    };
    const handleDragOver = (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); };
    const handleDragLeave = (e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setIsDragging(false);
        readFiles(Array.from(e.dataTransfer.files || []));
    };

    const editorHasServices = Object.keys(editorState?.services || {}).length > 0;
    const addFromEditor = useCallback(() => {
        const result = addProjectFromState(editorState, `${editorState?.name || 'editor-project'}.yml`);
        if (result.success) toast.success(`Added "${result.project.name}" from the editor`);
        else toast.error(result.error);
    }, [addProjectFromState, editorState, toast]);

    // ── Project actions ──
    const downloadProject = useCallback((project) => {
        downloadText(generateYaml(project.content), project.fileName || `${project.name}.yml`);
    }, []);

    const copyProject = useCallback(async (project) => {
        try {
            await navigator.clipboard.writeText(generateYaml(project.content));
            toast.success(`Copied ${project.name} YAML`);
        } catch {
            toast.error('Clipboard is not available');
        }
    }, [toast]);

    const openInEditor = useCallback(async (project) => {
        if (!window.confirm(`Replace the project currently open in the editor with "${project.name}"?`)) return;
        try {
            await loadFiles(generateYaml(project.content));
            setActiveView('editor');
            toast.success(`Opened ${project.name} in the editor`);
        } catch (e) {
            toast.error(`Could not open project: ${e.message}`);
        }
    }, [loadFiles, setActiveView, toast]);

    const promptRename = useCallback((project) => {
        const name = window.prompt('Project display name', project.name);
        if (name && name.trim()) renameProject(project.id, name);
    }, [renameProject]);

    const handleRemove = useCallback((projectId) => {
        const project = projects.find(p => p.id === projectId);
        removeProject(projectId);
        if (project) toast.info(`Removed ${project.name}. Press Ctrl+Z to undo.`);
    }, [projects, removeProject, toast]);

    const handleClearAll = useCallback(() => {
        if (projects.some(p => p.modified) && !window.confirm('Some projects have unsaved fixes. Clear everything?')) return;
        clearAllProjects();
        setSelectionState(null);
    }, [projects, clearAllProjects]);

    const modifiedProjects = projects.filter(p => p.modified);
    const downloadAllModified = useCallback(() => {
        modifiedProjects.forEach(downloadProject);
    }, [modifiedProjects, downloadProject]);

    // ── Fixes ──
    const handleApply = useCallback((proposal) => {
        applyFix(proposal);
        toast.success(`Applied: ${proposal.label}. Ctrl+Z to undo.`);
    }, [applyFix, toast]);

    // ── Issue navigation ──
    const stepIssue = useCallback((dir) => {
        if (activeResults.length === 0) return;
        const currentIdx = selection?.type === 'result' ? activeResults.findIndex(r => r.id === selection.resultId) : -1;
        const nextIdx = currentIdx < 0
            ? (dir > 0 ? 0 : activeResults.length - 1)
            : (currentIdx + dir + activeResults.length) % activeResults.length;
        select({ type: 'result', resultId: activeResults[nextIdx].id }, { focus: true });
    }, [activeResults, selection, select]);

    // ── Context menus ──
    const openProjectMenu = useCallback((project, x, y) => {
        setMenu({
            x, y, label: `${project.name} actions`,
            items: [
                { heading: project.name },
                { label: 'Inspect project', icon: Layers, onSelect: () => select({ type: 'project', projectId: project.id }, { focus: true }) },
                { label: 'Rename…', icon: Pencil, onSelect: () => promptRename(project) },
                { separator: true },
                { label: 'Download YAML', icon: Download, onSelect: () => downloadProject(project) },
                { label: 'Copy YAML', icon: Copy, onSelect: () => copyProject(project) },
                { label: 'Open in editor', icon: ExternalLink, onSelect: () => openInEditor(project) },
                { separator: true },
                { label: 'Reset applied fixes', icon: RotateCcw, disabled: !project.modified, onSelect: () => resetProject(project.id) },
                { label: 'Remove from comparison', icon: Trash2, danger: true, onSelect: () => handleRemove(project.id) },
            ],
        });
    }, [select, promptRename, downloadProject, copyProject, openInEditor, resetProject, handleRemove]);

    const handleDiagramContextMenu = useCallback(({ x, y, target }) => {
        setHover(null);
        const viewItems = [
            { label: 'Fit to view', icon: Maximize, hint: 'F', onSelect: () => diagramRef.current?.fit() },
            { label: 'Export diagram as SVG', icon: ImageDown, onSelect: () => diagramRef.current?.exportSvg() },
        ];
        if (!target) {
            setMenu({
                x, y, label: 'Diagram actions',
                items: [
                    ...viewItems,
                    { separator: true },
                    { label: 'Add project…', icon: Plus, disabled: projects.length >= maxProjects, onSelect: () => fileInputRef.current?.click() },
                    { label: 'Paste YAML…', icon: ClipboardPaste, disabled: projects.length >= maxProjects, onSelect: () => setPasteOpen(true) },
                ],
            });
            return;
        }

        if (target.type === 'project') {
            const project = projects.find(p => p.id === target.projectId);
            if (project) openProjectMenu(project, x, y);
            return;
        }

        if (target.type === 'service') {
            const project = projects.find(p => p.id === target.projectId);
            const issues = activeResults.filter(r => r.severity !== 'info'
                && (r.details || []).some(d => d.projectId === target.projectId && d.service === target.service));
            const quickFixes = issues.flatMap(r => {
                const best = proposalsFor(r)[0];
                return best ? [{ label: best.label, icon: Sparkles, iconClass: 'text-accent', onSelect: () => handleApply(best) }] : [];
            }).slice(0, 4);
            setMenu({
                x, y, label: `${target.service} actions`,
                items: [
                    { heading: `${project?.name || ''} / ${target.service}` },
                    { label: 'Inspect service', icon: Box, onSelect: () => select(target) },
                    { label: 'Focus related', icon: Focus, onSelect: () => select(target, { focus: true }) },
                    ...(quickFixes.length > 0 ? [{ separator: true }, { heading: 'Quick fixes' }, ...quickFixes] : []),
                    ...(issues.length > 0 ? [{ separator: true }, ...issues.slice(0, 4).map(r => ({
                        label: r.message, icon: SEVERITY_META[r.severity].icon, iconClass: SEVERITY_META[r.severity].text,
                        onSelect: () => select({ type: 'result', resultId: r.id }, { focus: true }),
                    }))] : []),
                    { separator: true },
                    { label: 'Copy service name', icon: Copy, onSelect: () => navigator.clipboard?.writeText(target.service) },
                    { label: 'Search in issues', icon: Search, onSelect: () => { setPanelCollapsed(false); select(target); } },
                ],
            });
            return;
        }

        if (target.type === 'result') {
            const result = results.find(r => r.id === target.resultId);
            if (!result) return;
            const proposals = proposalsFor(result);
            const isDismissed = dismissedSet.has(result.id);
            setMenu({
                x, y, label: 'Issue actions',
                items: [
                    { heading: result.message },
                    { label: 'Inspect issue', icon: Info, onSelect: () => select(target) },
                    { label: 'Focus affected services', icon: Focus, onSelect: () => select(target, { focus: true }) },
                    ...(proposals.length > 0 ? [{ separator: true }, { heading: 'Fixes' }, ...proposals.map(p => ({
                        label: p.label, icon: Sparkles, iconClass: p.recommended ? 'text-accent' : undefined, onSelect: () => handleApply(p),
                    }))] : []),
                    { separator: true },
                    { label: isDismissed ? 'Restore issue' : 'Ignore (intentional)', icon: isDismissed ? Eye : EyeOff, onSelect: () => toggleDismissed(result.id) },
                ],
            });
        }
    }, [projects, maxProjects, activeResults, results, dismissedSet, proposalsFor, handleApply, select, toggleDismissed, openProjectMenu]);

    // ── Keyboard shortcuts ──
    useEffect(() => {
        if (!ready) return undefined;
        const onKey = (e) => {
            if (isTypingTarget(document.activeElement) || pasteOpen || menu) return;
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
            if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
            if (mod || e.altKey) return;
            switch (e.key) {
                case 'Escape': setSelectionState(null); setShowShortcuts(false); break;
                case 'f': case 'F': diagramRef.current?.fit(); break;
                case '+': case '=': diagramRef.current?.zoomIn(); break;
                case '-': case '_': diagramRef.current?.zoomOut(); break;
                case 'j': case 'J': case 'ArrowDown': if (e.key === 'ArrowDown' && !selection) return; e.preventDefault(); stepIssue(1); break;
                case 'k': case 'K': case 'ArrowUp': if (e.key === 'ArrowUp' && !selection) return; e.preventDefault(); stepIssue(-1); break;
                case '?': setShowShortcuts(s => !s); break;
                default: break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [ready, pasteOpen, menu, undo, redo, stepIssue, selection]);

    // Lock page scroll while compare mode is mounted (the diagram owns the wheel).
    // The body class also lets CSS hide floating third-party widgets that cover the panels.
    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.body.classList.add('compare-mode');
        return () => {
            document.body.style.overflow = original;
            document.body.classList.remove('compare-mode');
        };
    }, []);

    const closeMenu = useCallback(() => setMenu(null), []);
    const handleHover = useCallback((h) => setHover(menu ? null : h), [menu]);
    const handleSelect = useCallback((sel) => { setMenu(null); select(sel); }, [select]);

    const errorCount = activeResults.filter(r => r.severity === 'error').length;

    return (
        <div
            className="flex-1 flex flex-col overflow-hidden relative"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Toolbar */}
            <div className="px-4 py-3 bg-surface border-b border-border/50 shadow-lg z-30">
                <div className="w-full flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap" role="list" aria-label="Compared projects">
                        {projects.map(p => (
                            <div role="listitem" key={p.id}>
                                <ProjectChip
                                    project={p}
                                    color={projectColor(projects, p.id)}
                                    issueCount={issueCountByProject.get(p.id) || 0}
                                    active={selection?.type === 'project' && selection.projectId === p.id}
                                    onSelect={() => ready && select({ type: 'project', projectId: p.id }, { focus: true })}
                                    onOpenMenu={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        openProjectMenu(p, rect.left, rect.bottom + 6);
                                    }}
                                />
                            </div>
                        ))}
                        {projects.length < maxProjects && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenu({
                                        x: rect.left, y: rect.bottom + 6, label: 'Add project',
                                        items: [
                                            { label: 'Upload compose file(s)…', icon: Upload, onSelect: () => fileInputRef.current?.click() },
                                            { label: 'Paste YAML…', icon: ClipboardPaste, onSelect: () => setPasteOpen(true) },
                                            { label: 'Use editor project', icon: FileCode2, disabled: !editorHasServices, onSelect: addFromEditor },
                                        ],
                                    });
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-dashed border-accent/40 text-accent hover:bg-accent/10 transition-all flex items-center gap-1.5"
                                aria-haspopup="menu"
                            >
                                <Plus size={14} />
                                <span className="text-xs font-semibold uppercase tracking-wider">Add project</span>
                                <span className="text-[10px] text-text-tertiary normal-case">{projects.length}/{maxProjects}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        {ready && (
                            <span className={`hidden lg:flex items-center gap-1.5 text-xs mr-2 ${errorCount > 0 ? 'text-error' : 'text-success'}`}>
                                {errorCount > 0 ? <XCircle size={14} /> : <Sparkles size={14} />}
                                {errorCount > 0 ? `${errorCount} blocking conflict${errorCount === 1 ? '' : 's'}` : 'Projects can run side by side'}
                            </span>
                        )}
                        <button type="button" onClick={undo} disabled={!canUndo} className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none" title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={16} /></button>
                        <button type="button" onClick={redo} disabled={!canRedo} className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none" title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 size={16} /></button>
                        {modifiedProjects.length > 0 && (
                            <button type="button" onClick={downloadAllModified} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-accent text-black hover:brightness-110 transition-all">
                                <Download size={14} /> Download fixed ({modifiedProjects.length})
                            </button>
                        )}
                        {projects.length > 0 && (
                            <button type="button" onClick={handleClearAll} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-error hover:bg-error/10 transition-all">
                                <Trash2 size={14} /> Clear all
                            </button>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".yml,.yaml" multiple className="hidden" data-testid="compare-file-input" />
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 overflow-hidden relative">
                {!ready ? (
                    <EmptyState
                        projectCount={projects.length}
                        maxProjects={maxProjects}
                        onUpload={() => fileInputRef.current?.click()}
                        onPaste={() => setPasteOpen(true)}
                        onUseEditor={addFromEditor}
                        editorHasServices={editorHasServices}
                    />
                ) : (
                    <>
                        <CompareDiagram
                            ref={diagramRef}
                            projects={projects}
                            results={results}
                            dismissed={dismissed}
                            selection={selection}
                            onSelect={handleSelect}
                            onContextMenu={handleDiagramContextMenu}
                            onHover={handleHover}
                            getInsets={getInsets}
                            onViewChange={setZoom}
                        />

                        <ResultsPanel
                            results={results}
                            projects={projects}
                            dismissed={dismissed}
                            activeResultId={selection?.type === 'result' ? selection.resultId : null}
                            fixCounts={fixCounts}
                            onSelectResult={(r) => select({ type: 'result', resultId: r.id }, { focus: true })}
                            onStep={stepIssue}
                            collapsed={panelCollapsed}
                            onToggleCollapsed={() => setPanelCollapsed(c => !c)}
                        />

                        <InspectorPanel
                            selection={selection}
                            projects={projects}
                            results={results}
                            dismissed={dismissed}
                            proposalsFor={proposalsFor}
                            onApply={handleApply}
                            onToggleDismiss={toggleDismissed}
                            onSelect={(sel) => select(sel, { focus: true })}
                            onClose={() => setSelectionState(null)}
                            onFocus={() => diagramRef.current?.focusSelection()}
                            onDownload={downloadProject}
                            onCopy={copyProject}
                            onReset={resetProject}
                            onRemove={handleRemove}
                            onNext={() => stepIssue(1)}
                            hasMoreIssues={activeResults.length > 0}
                        />

                        {/* Zoom controls */}
                        <div
                            className="absolute bottom-4 z-10 flex items-center gap-1 glass rounded-xl border border-border/60 p-1 shadow-lg transition-[right] duration-200"
                            style={{ right: selection ? RIGHT_PANEL_INSET : 16 }}
                        >
                            <button type="button" onClick={() => diagramRef.current?.zoomOut()} className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Zoom out (−)" aria-label="Zoom out"><ZoomOut size={16} /></button>
                            <span className="w-12 text-center text-xs tabular-nums text-text-secondary" aria-live="polite">{Math.round(zoom * 100)}%</span>
                            <button type="button" onClick={() => diagramRef.current?.zoomIn()} className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Zoom in (+)" aria-label="Zoom in"><ZoomIn size={16} /></button>
                            <div className="w-px h-5 bg-border/60 mx-0.5" />
                            <button type="button" onClick={() => diagramRef.current?.fit()} className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Fit to view (F)" aria-label="Fit to view"><Maximize size={16} /></button>
                            <button type="button" onClick={() => diagramRef.current?.focusSelection()} disabled={!selection} className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none" title="Focus selection" aria-label="Focus selection"><Focus size={16} /></button>
                            <button type="button" onClick={() => diagramRef.current?.exportSvg()} className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Export SVG" aria-label="Export SVG"><ImageDown size={16} /></button>
                            <button type="button" onClick={() => setShowShortcuts(s => !s)} className={`p-2 rounded-lg hover:bg-white/5 ${showShortcuts ? 'text-accent' : 'text-text-secondary hover:text-text'}`} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" aria-expanded={showShortcuts}><Keyboard size={16} /></button>
                        </div>

                        {/* Legend */}
                        <div
                            className="absolute bottom-4 z-10 glass rounded-xl border border-border/60 px-3 py-2 shadow-lg text-[11px] text-text-secondary flex items-center gap-4 flex-wrap transition-[left] duration-200 pointer-events-none"
                            style={{ left: panelCollapsed ? 16 : LEFT_PANEL_INSET }}
                        >
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-error bg-red-950" /> Conflict</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-warning bg-amber-950" /> Warning</span>
                            <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-error" /> Claims a conflict</span>
                            <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-violet-400" /> Shared</span>
                            <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dotted border-violet-400" /> Isolated</span>
                        </div>

                        {showShortcuts && (
                            <div
                                className="absolute bottom-20 z-20 glass rounded-xl border border-border/60 p-3 shadow-xl text-xs w-64"
                                style={{ right: selection ? RIGHT_PANEL_INSET : 16 }}
                                role="dialog"
                                aria-label="Keyboard shortcuts"
                            >
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-2">Shortcuts</h3>
                                <dl className="space-y-1">
                                    {SHORTCUTS.map(([k, v]) => (
                                        <div key={k} className="flex justify-between gap-3">
                                            <dt><kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-border/60 text-[10px]">{k}</kbd></dt>
                                            <dd className="text-text-secondary text-right">{v}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        )}
                    </>
                )}
            </div>

            {isDragging && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/80 backdrop-blur-sm border-2 border-dashed border-accent rounded-xl m-2 pointer-events-none">
                    <div className="text-center space-y-2">
                        <Upload size={40} className="mx-auto text-accent" />
                        <p className="text-lg font-bold">Drop compose files to compare</p>
                        <p className="text-sm text-text-secondary">{Math.max(0, maxProjects - projects.length)} slot(s) left</p>
                    </div>
                </div>
            )}

            {menu && <FloatingMenu x={menu.x} y={menu.y} items={menu.items} label={menu.label} onClose={closeMenu} />}
            {!menu && hover && <HoverCard hover={hover} projects={projects} results={activeResults} />}
            {pasteOpen && <PasteYamlModal onSubmit={addProject} onClose={() => setPasteOpen(false)} />}
        </div>
    );
}

CompareView.displayName = 'CompareView';

export default CompareView;
