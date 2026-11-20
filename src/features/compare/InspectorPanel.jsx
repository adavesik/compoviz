import { memo, useMemo } from 'react';
import {
    ArrowRight, Box, Copy, Download, Eye, EyeOff, Focus, Layers, RotateCcw, Sparkles, Trash2, Wrench, X,
} from 'lucide-react';
import { normalizeToAST } from '../../models/normalizeToAST';
import { getEffectiveProjectName } from '../../utils/comparison';
import { CATEGORY_LABELS, SEVERITY_META, projectColor } from './compareUi';

const Section = ({ title, children, action }) => (
    <section className="space-y-2">
        <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{title}</h3>
            {action}
        </div>
        {children}
    </section>
);

const ProjectDot = ({ color }) => (
    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
);

/** One fix proposal with a before/after preview of every change. */
export const FixProposalCard = memo(function FixProposalCard({ proposal, projects, onApply, compact = false }) {
    return (
        <div className={`rounded-xl border p-3 space-y-2 ${proposal.recommended ? 'border-accent/50 bg-accent/5' : 'border-border/60 bg-black/20'}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-text flex items-center gap-1.5">
                        {proposal.recommended && <Sparkles size={12} className="text-accent shrink-0" aria-label="Recommended" />}
                        <span className="break-words">{proposal.label}</span>
                    </p>
                    {!compact && <p className="text-[11px] text-text-secondary mt-1 leading-snug">{proposal.description}</p>}
                </div>
                <button
                    type="button"
                    onClick={() => onApply(proposal)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${proposal.recommended ? 'bg-accent text-black hover:brightness-110' : 'bg-white/10 text-text hover:bg-white/20'}`}
                >
                    Apply
                </button>
            </div>
            {!compact && (
                <ul className="space-y-1">
                    {proposal.changes.map((c, i) => (
                        <li key={i} className="text-[10px] font-mono bg-black/30 rounded-md px-2 py-1.5 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-text-secondary font-sans">
                                <ProjectDot color={projectColor(projects, c.projectId)} />
                                <span className="truncate">{c.project}{c.service ? ` / ${c.service}` : ''}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-red-300 line-through break-all">{c.before ?? '—'}</span>
                                <ArrowRight size={10} className="text-text-tertiary shrink-0" aria-hidden="true" />
                                <span className="text-emerald-300 break-all">{c.after ?? '(removed)'}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
});

function ResultInspector({ result, projects, proposals, isDismissed, onApply, onToggleDismiss, onSelect }) {
    const meta = SEVERITY_META[result.severity];
    const Icon = meta.icon;
    return (
        <>
            <header className="space-y-2">
                <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>
                    <Icon size={14} aria-hidden="true" />
                    {result.severity} · {CATEGORY_LABELS[result.category] || result.category}
                </div>
                <h2 className="text-sm font-bold leading-snug break-words">{result.message}</h2>
                {result.explanation && <p className="text-xs text-text-secondary leading-relaxed">{result.explanation}</p>}
            </header>

            <Section title={`Affected (${(result.details || []).length})`}>
                <ul className="space-y-1">
                    {(result.details || []).map((d, i) => (
                        <li key={i}>
                            <button
                                type="button"
                                disabled={!d.service}
                                onClick={() => d.service && onSelect({ type: 'service', projectId: d.projectId, service: d.service })}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/20 hover:bg-white/5 disabled:hover:bg-black/20 text-left text-xs transition-colors"
                            >
                                <ProjectDot color={projectColor(projects, d.projectId)} />
                                <span className="text-text-secondary truncate">{d.project}</span>
                                {d.service && <span className="font-semibold truncate">/ {d.service}</span>}
                                {d.mapping && <code className="ml-auto text-[10px] text-text-tertiary truncate max-w-[45%]">{String(d.mapping)}</code>}
                            </button>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title="Suggested fixes">
                {proposals.length === 0 ? (
                    <p className="text-xs text-text-secondary">
                        {result.severity === 'info'
                            ? 'Informational. Nothing needs to change unless this overlap is unintended.'
                            : 'No automatic fix available for this issue.'}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {proposals.map(p => <FixProposalCard key={p.id} proposal={p} projects={projects} onApply={onApply} />)}
                    </div>
                )}
            </Section>

            <button
                type="button"
                onClick={() => onToggleDismiss(result.id)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-border/60 text-xs text-text-secondary hover:text-text hover:border-text-secondary transition-colors"
            >
                {isDismissed ? <><Eye size={14} /> Restore issue</> : <><EyeOff size={14} /> Ignore (intentional)</>}
            </button>
        </>
    );
}

const KV = ({ label, children }) => (
    <div className="grid grid-cols-[88px_1fr] gap-2 text-xs py-1 border-b border-border/30 last:border-0">
        <dt className="text-text-tertiary">{label}</dt>
        <dd className="min-w-0 break-words">{children}</dd>
    </div>
);

function ServiceInspector({ selection, projects, results, proposalsFor, onApply, onSelect }) {
    const project = projects.find(p => p.id === selection.projectId);
    const raw = project?.content?.services?.[selection.service];
    const node = useMemo(() => {
        if (!project) return null;
        return normalizeToAST(project.content).serviceMap.get(selection.service) || null;
    }, [project, selection.service]);

    if (!project || !raw) {
        return <p className="text-xs text-text-secondary">This service no longer exists.</p>;
    }

    const issues = results.filter(r => (r.details || []).some(d => d.projectId === project.id && d.service === selection.service));
    const conflictingMappings = new Set(issues.flatMap(r => (r.details || [])
        .filter(d => d.projectId === project.id && d.service === selection.service && d.mapping)
        .map(d => String(d.mapping))));

    return (
        <>
            <header className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    <Box size={12} aria-hidden="true" /> Service
                </div>
                <h2 className="text-base font-bold break-words">{selection.service}</h2>
                <button
                    type="button"
                    onClick={() => onSelect({ type: 'project', projectId: project.id })}
                    className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text"
                >
                    <ProjectDot color={projectColor(projects, project.id)} /> {project.name}
                </button>
            </header>

            <dl>
                <KV label="Image">{raw.image || (raw.build ? <span className="text-text-secondary">build: {typeof raw.build === 'string' ? raw.build : raw.build.context || '.'}</span> : '—')}</KV>
                {raw.container_name && <KV label="Container">{raw.container_name}</KV>}
                <KV label="Ports">
                    {node?.ports?.length ? (
                        <div className="flex flex-wrap gap-1">
                            {node.ports.map((p, i) => (
                                <code key={i} className={`px-1.5 py-0.5 rounded text-[10px] ${conflictingMappings.has(String(p.raw)) ? 'bg-error/20 text-red-300 ring-1 ring-error/50' : 'bg-black/30'}`}>{p.raw}</code>
                            ))}
                        </div>
                    ) : '—'}
                </KV>
                <KV label="Networks">{node?.networks?.length ? node.networks.map(n => n.network).join(', ') : 'default'}</KV>
                {node?.volumes?.length > 0 && (
                    <KV label="Volumes">
                        <div className="space-y-0.5">
                            {node.volumes.map((v, i) => (
                                <code key={i} className={`block text-[10px] truncate ${conflictingMappings.has(String(v.raw)) ? 'text-amber-300' : ''}`}>{v.raw}</code>
                            ))}
                        </div>
                    </KV>
                )}
                {node?.envFiles?.length > 0 && <KV label="Env files">{node.envFiles.join(', ')}</KV>}
                {node?.dependencies?.length > 0 && <KV label="Depends on">{node.dependencies.map(d => d.service).join(', ')}</KV>}
            </dl>

            <Section title={`Issues (${issues.length})`}>
                {issues.length === 0 ? (
                    <p className="text-xs text-success">No cross-project issues for this service.</p>
                ) : (
                    <div className="space-y-2">
                        {issues.map(r => {
                            const meta = SEVERITY_META[r.severity];
                            const Icon = meta.icon;
                            const quick = proposalsFor(r)[0];
                            return (
                                <div key={r.id} className={`rounded-xl border p-2.5 space-y-2 ${meta.card}`}>
                                    <button type="button" onClick={() => onSelect({ type: 'result', resultId: r.id })} className="w-full flex gap-2 text-left text-xs hover:brightness-125">
                                        <Icon size={13} className={`shrink-0 mt-0.5 ${meta.text}`} aria-hidden="true" />
                                        <span className="leading-snug">{r.message}</span>
                                    </button>
                                    {quick && <FixProposalCard proposal={quick} projects={projects} onApply={onApply} compact />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>
        </>
    );
}

function ProjectInspector({ selection, projects, results, onSelect, onDownload, onCopy, onReset, onRemove }) {
    const project = projects.find(p => p.id === selection.projectId);
    if (!project) return <p className="text-xs text-text-secondary">This project was removed.</p>;
    const services = Object.keys(project.content?.services || {});
    const issues = results.filter(r => r.projectIds?.includes(project.id) && r.severity !== 'info');

    return (
        <>
            <header className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                    <Layers size={12} aria-hidden="true" /> Project
                </div>
                <h2 className="text-base font-bold flex items-center gap-2 break-words">
                    <ProjectDot color={projectColor(projects, project.id)} /> {project.name}
                </h2>
                <p className="text-xs text-text-secondary">
                    Compose project: <code className="text-text">{getEffectiveProjectName(project) || '—'}</code>
                    {project.modified && <span className="ml-2 text-accent">• modified</span>}
                </p>
            </header>

            <Section title={`Services (${services.length})`}>
                <div className="flex flex-wrap gap-1.5">
                    {services.map(s => (
                        <button key={s} type="button" onClick={() => onSelect({ type: 'service', projectId: project.id, service: s })} className="px-2 py-1 rounded-lg bg-black/30 hover:bg-white/10 text-xs transition-colors">
                            {s}
                        </button>
                    ))}
                </div>
            </Section>

            <Section title={`Errors & warnings (${issues.length})`}>
                {issues.length === 0 ? <p className="text-xs text-success">None.</p> : (
                    <ul className="space-y-1">
                        {issues.map(r => (
                            <li key={r.id}>
                                <button type="button" onClick={() => onSelect({ type: 'result', resultId: r.id })} className={`w-full text-left text-xs p-2 rounded-lg border ${SEVERITY_META[r.severity].card} hover:brightness-125`}>
                                    {r.message}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onDownload(project)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium"><Download size={13} /> Download</button>
                <button type="button" onClick={() => onCopy(project)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium"><Copy size={13} /> Copy YAML</button>
                <button type="button" disabled={!project.modified} onClick={() => onReset(project.id)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-xs text-text-secondary hover:text-text disabled:opacity-40 disabled:pointer-events-none"><RotateCcw size={13} /> Reset</button>
                <button type="button" onClick={() => onRemove(project.id)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-xs text-text-secondary hover:text-error hover:border-error/50"><Trash2 size={13} /> Remove</button>
            </div>
        </>
    );
}

/**
 * Right-hand inspector. Shows details and fix proposals for the selected
 * result, service or project.
 */
function InspectorPanel({
    selection,
    projects,
    results,
    dismissed,
    proposalsFor,
    onApply,
    onToggleDismiss,
    onSelect,
    onClose,
    onFocus,
    onDownload,
    onCopy,
    onReset,
    onRemove,
    onNext,
    hasMoreIssues,
}) {
    if (!selection) return null;
    const result = selection.type === 'result' ? results.find(r => r.id === selection.resultId) : null;

    return (
        <aside
            className="absolute top-4 right-4 bottom-4 z-20 w-96 max-w-[calc(100%-2rem)] flex flex-col glass rounded-2xl border border-border/60 shadow-2xl overflow-hidden"
            aria-label="Inspector"
        >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 flex-shrink-0">
                <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5"><Wrench size={12} /> Inspector</span>
                <div className="flex items-center gap-0.5">
                    <button type="button" onClick={onFocus} className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Focus in diagram" aria-label="Focus selection in diagram"><Focus size={14} /></button>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Close (Esc)" aria-label="Close inspector"><X size={14} /></button>
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
                {selection.type === 'result' && result && (
                    <ResultInspector
                        result={result}
                        projects={projects}
                        proposals={proposalsFor(result)}
                        isDismissed={dismissed.includes(result.id)}
                        onApply={onApply}
                        onToggleDismiss={onToggleDismiss}
                        onSelect={onSelect}
                    />
                )}
                {selection.type === 'result' && !result && (
                    <div className="text-center py-8 space-y-2">
                        <Sparkles className="mx-auto text-success" size={28} aria-hidden="true" />
                        <p className="text-sm font-semibold">Resolved</p>
                        <p className="text-xs text-text-secondary">This issue no longer occurs.</p>
                        {hasMoreIssues && (
                            <button type="button" onClick={onNext} className="mt-2 px-4 py-2 rounded-xl bg-accent text-black text-xs font-bold hover:brightness-110">
                                Next issue →
                            </button>
                        )}
                    </div>
                )}
                {selection.type === 'service' && (
                    <ServiceInspector selection={selection} projects={projects} results={results} proposalsFor={proposalsFor} onApply={onApply} onSelect={onSelect} />
                )}
                {selection.type === 'project' && (
                    <ProjectInspector selection={selection} projects={projects} results={results} onSelect={onSelect} onDownload={onDownload} onCopy={onCopy} onReset={onReset} onRemove={onRemove} />
                )}
            </div>
        </aside>
    );
}

export default memo(InspectorPanel);
