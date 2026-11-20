import { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, EyeOff, PanelLeftClose, Search, Wrench, CheckCircle2 } from 'lucide-react';
import { CATEGORY_LABELS, SEVERITY_META, projectColor } from './compareUi';

const SEVERITIES = ['error', 'warning', 'info'];

const ResultCard = memo(function ResultCard({ result, active, projects, fixCount, onSelect, dimmed }) {
    const meta = SEVERITY_META[result.severity];
    const Icon = meta.icon;
    return (
        <button
            type="button"
            onClick={() => onSelect(result)}
            aria-pressed={active}
            className={`w-full text-left p-3 rounded-xl border text-xs flex gap-3 transition-all hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${active ? meta.cardActive : meta.card} ${dimmed ? 'opacity-60' : ''}`}
        >
            <Icon size={14} className={`shrink-0 mt-0.5 ${meta.text}`} aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <span className={`font-bold uppercase tracking-wider text-[10px] ${meta.text} opacity-80`}>
                        {CATEGORY_LABELS[result.category] || result.category}
                        {result.type === 'isolated' && ' · isolated'}
                    </span>
                    {fixCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-accent font-semibold shrink-0">
                            <Wrench size={10} aria-hidden="true" />{fixCount} fix{fixCount === 1 ? '' : 'es'}
                        </span>
                    )}
                </div>
                <p className="font-medium leading-snug text-text break-words">{result.message}</p>
                <div className="flex flex-wrap gap-1">
                    {(result.projectIds || []).map((pid, i) => (
                        <span key={pid} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/30 text-[10px] text-text-secondary">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: projectColor(projects, pid) }} aria-hidden="true" />
                            {result.projects?.[i]}
                        </span>
                    ))}
                </div>
            </div>
        </button>
    );
});

/**
 * Left-hand list of comparison results with severity filters, search and
 * keyboard-friendly navigation.
 */
function ResultsPanel({
    results,
    projects,
    dismissed,
    activeResultId,
    fixCounts,
    onSelectResult,
    onStep,
    collapsed,
    onToggleCollapsed,
}) {
    const [filters, setFilters] = useState({ error: true, warning: true, info: true });
    const [query, setQuery] = useState('');
    const [showIgnored, setShowIgnored] = useState(false);

    const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);
    const counts = useMemo(() => {
        const c = { error: 0, warning: 0, info: 0 };
        results.forEach(r => { if (!dismissedSet.has(r.id)) c[r.severity]++; });
        return c;
    }, [results, dismissedSet]);

    const q = query.trim().toLowerCase();
    const matches = (r) => !q || r.message.toLowerCase().includes(q)
        || (r.details || []).some(d => String(d.service || '').toLowerCase().includes(q));
    const visible = results.filter(r => !dismissedSet.has(r.id) && filters[r.severity] && matches(r));
    const ignored = results.filter(r => dismissedSet.has(r.id) && matches(r));
    const blocking = counts.error + counts.warning;

    if (collapsed) {
        return (
            <button
                type="button"
                onClick={onToggleCollapsed}
                className="absolute top-4 left-4 z-20 glass rounded-xl border border-border/60 shadow-xl px-3 py-2 flex items-center gap-2 text-xs hover:border-accent transition-colors"
                aria-label="Show analysis panel"
            >
                <ChevronRight size={14} />
                <span className="font-semibold">Analysis</span>
                {counts.error > 0 && <span className="px-1.5 rounded-full bg-error text-white text-[10px] font-bold">{counts.error}</span>}
                {counts.warning > 0 && <span className="px-1.5 rounded-full bg-warning text-black text-[10px] font-bold">{counts.warning}</span>}
            </button>
        );
    }

    return (
        <aside
            className="absolute top-4 left-4 bottom-4 z-20 w-80 flex flex-col glass rounded-2xl border border-border/60 shadow-2xl animate-slide-in overflow-hidden"
            aria-label="Analysis results"
        >
            <div className="p-4 pb-3 border-b border-border/50 space-y-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-bold flex items-center gap-2">
                        Analysis
                        {blocking === 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-success/20 text-success">Ready to run</span>
                        ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-error text-white">
                                {blocking} to resolve
                            </span>
                        )}
                    </h2>
                    <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => onStep(-1)} className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Previous issue (K)" aria-label="Previous issue"><ChevronUp size={14} /></button>
                        <button type="button" onClick={() => onStep(1)} className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Next issue (J)" aria-label="Next issue"><ChevronDown size={14} /></button>
                        <button type="button" onClick={onToggleCollapsed} className="p-1.5 rounded-lg text-text-secondary hover:text-text hover:bg-white/5" title="Hide panel" aria-label="Hide analysis panel"><PanelLeftClose size={14} /></button>
                    </div>
                </div>

                <div className="flex gap-1.5" role="group" aria-label="Filter by severity">
                    {SEVERITIES.map(sev => {
                        const meta = SEVERITY_META[sev];
                        const on = filters[sev];
                        return (
                            <button
                                key={sev}
                                type="button"
                                aria-pressed={on}
                                onClick={() => setFilters(f => ({ ...f, [sev]: !f[sev] }))}
                                className={`flex-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all ${on ? meta.chip : 'border-border/50 text-text-tertiary line-through'}`}
                            >
                                {counts[sev]} {meta.label}
                            </button>
                        );
                    })}
                </div>

                <label className="relative block">
                    <span className="sr-only">Filter issues</span>
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Filter by service or text…"
                        className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-black/30 border border-border/50 text-xs focus:outline-none focus:border-accent"
                    />
                </label>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                {visible.length === 0 && (
                    <div className="py-8 text-center text-xs text-text-secondary space-y-2">
                        <CheckCircle2 size={28} className="mx-auto text-success" aria-hidden="true" />
                        <p>{results.length === 0 ? 'No conflicts or overlaps between these projects.' : 'Nothing matches the current filters.'}</p>
                    </div>
                )}
                {visible.map(r => (
                    <ResultCard
                        key={r.id}
                        result={r}
                        projects={projects}
                        active={r.id === activeResultId}
                        fixCount={fixCounts.get(r.id) || 0}
                        onSelect={onSelectResult}
                    />
                ))}

                {ignored.length > 0 && (
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setShowIgnored(s => !s)}
                            className="w-full flex items-center gap-2 text-[11px] text-text-secondary hover:text-text py-1"
                            aria-expanded={showIgnored}
                        >
                            {showIgnored ? <ChevronDown size={12} /> : <ChevronLeft size={12} className="-rotate-90" />}
                            <EyeOff size={12} aria-hidden="true" /> Ignored ({ignored.length})
                        </button>
                        {showIgnored && (
                            <div className="space-y-2 mt-2">
                                {ignored.map(r => (
                                    <ResultCard
                                        key={r.id}
                                        result={r}
                                        projects={projects}
                                        active={r.id === activeResultId}
                                        fixCount={0}
                                        onSelect={onSelectResult}
                                        dimmed
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}

export default memo(ResultsPanel);
