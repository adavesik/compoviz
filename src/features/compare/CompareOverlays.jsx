import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPaste, X } from 'lucide-react';
import { SEVERITY_META } from './compareUi';

/**
 * Generic floating menu rendered in a portal and kept inside the viewport.
 * items: Array<{ label, icon?, onSelect, danger?, disabled?, hint? } | { separator: true } | { heading: string }>
 */
export const FloatingMenu = memo(function FloatingMenu({ x, y, items, onClose, label = 'Menu' }) {
    const ref = useRef(null);
    const [pos, setPos] = useState({ left: x, top: y });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setPos({
            left: Math.min(x, window.innerWidth - rect.width - 8),
            top: Math.min(y, window.innerHeight - rect.height - 8),
        });
        el.querySelector('button:not([disabled])')?.focus();
    }, [x, y]);

    useEffect(() => {
        const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const buttons = [...ref.current.querySelectorAll('button:not([disabled])')];
                const idx = buttons.indexOf(document.activeElement);
                const next = e.key === 'ArrowDown' ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length;
                buttons[next]?.focus();
            }
        };
        window.addEventListener('pointerdown', onDown, true);
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('blur', onClose);
        return () => {
            window.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('blur', onClose);
        };
    }, [onClose]);

    return createPortal(
        <div
            ref={ref}
            role="menu"
            aria-label={label}
            className="fixed z-[100] min-w-[220px] max-w-[320px] py-1.5 rounded-xl border border-border bg-surface-raised shadow-2xl animate-fade-in"
            style={{ left: pos.left, top: pos.top }}
            onContextMenu={e => e.preventDefault()}
        >
            {items.map((item, i) => {
                if (item.separator) return <div key={i} className="my-1 h-px bg-border/60" role="separator" />;
                if (item.heading) return <div key={i} className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary truncate">{item.heading}</div>;
                const Icon = item.icon;
                return (
                    <button
                        key={i}
                        type="button"
                        role="menuitem"
                        disabled={item.disabled}
                        onClick={() => { onClose(); item.onSelect(); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors disabled:opacity-40 focus:outline-none focus:bg-white/10 hover:bg-white/10 ${item.danger ? 'text-error' : 'text-text'}`}
                    >
                        {Icon && <Icon size={14} className={`shrink-0 ${item.iconClass || 'text-text-secondary'}`} aria-hidden="true" />}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.hint && <kbd className="text-[10px] text-text-tertiary font-sans">{item.hint}</kbd>}
                    </button>
                );
            })}
        </div>,
        document.body
    );
});

/** Small card that follows hovered diagram elements. */
export const HoverCard = memo(function HoverCard({ hover, projects, results }) {
    if (!hover) return null;
    let title = '';
    let subtitle = '';
    let issues = [];
    if (hover.type === 'service') {
        title = hover.service;
        subtitle = projects.find(p => p.id === hover.projectId)?.name || '';
        issues = results.filter(r => r.severity !== 'info'
            && (r.details || []).some(d => d.projectId === hover.projectId && d.service === hover.service));
    } else if (hover.type === 'result') {
        const r = results.find(x => x.id === hover.resultId);
        if (!r) return null;
        title = r.message;
        subtitle = r.projects?.join(' · ');
    }
    return createPortal(
        <div
            className="fixed z-[90] pointer-events-none max-w-xs px-3 py-2 rounded-lg border border-border bg-surface-raised/95 shadow-xl text-xs"
            style={{
                // Flip to the other side of the cursor near the viewport edges
                left: hover.x > window.innerWidth - 340 ? undefined : hover.x + 14,
                right: hover.x > window.innerWidth - 340 ? window.innerWidth - hover.x + 14 : undefined,
                top: hover.y > window.innerHeight - 200 ? undefined : hover.y + 14,
                bottom: hover.y > window.innerHeight - 200 ? window.innerHeight - hover.y + 14 : undefined,
            }}
            role="tooltip"
        >
            <p className="font-semibold break-words">{title}</p>
            {subtitle && <p className="text-text-secondary text-[11px]">{subtitle}</p>}
            {issues.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                    {issues.slice(0, 3).map(r => (
                        <li key={r.id} className={`text-[11px] ${SEVERITY_META[r.severity].text}`}>• {r.message}</li>
                    ))}
                    {issues.length > 3 && <li className="text-[11px] text-text-tertiary">+{issues.length - 3} more</li>}
                </ul>
            )}
            <p className="mt-1.5 text-[10px] text-text-tertiary">Click to inspect · Right-click for actions</p>
        </div>,
        document.body
    );
});

/** Modal for pasting compose YAML directly. */
export function PasteYamlModal({ onSubmit, onClose }) {
    const [name, setName] = useState('');
    const [text, setText] = useState('');
    const [error, setError] = useState(null);
    const textRef = useRef(null);

    useEffect(() => {
        textRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const submit = (e) => {
        e.preventDefault();
        const result = onSubmit(text, name.trim() ? `${name.trim()}.yml` : 'pasted-compose.yml');
        if (result?.success) onClose();
        else setError(result?.error || 'Could not parse YAML');
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <form
                onSubmit={submit}
                role="dialog"
                aria-modal="true"
                aria-labelledby="paste-yaml-title"
                className="w-full max-w-2xl rounded-2xl border border-border bg-surface shadow-2xl flex flex-col max-h-[85vh]"
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                    <h2 id="paste-yaml-title" className="font-bold flex items-center gap-2"><ClipboardPaste size={16} className="text-accent" /> Paste compose YAML</h2>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-text-secondary hover:text-text" aria-label="Close"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3 flex-1 min-h-0 flex flex-col">
                    <label className="block text-xs text-text-secondary">
                        Project name (optional, defaults to <code>name:</code> in the file)
                        <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-black/30 border border-border focus:border-accent focus:outline-none text-sm text-text" placeholder="my-stack" />
                    </label>
                    <label className="flex-1 min-h-0 flex flex-col text-xs text-text-secondary">
                        YAML
                        <textarea
                            ref={textRef}
                            value={text}
                            onChange={e => { setText(e.target.value); setError(null); }}
                            spellCheck={false}
                            className="mt-1 flex-1 min-h-[280px] w-full p-3 rounded-lg bg-black/40 border border-border focus:border-accent focus:outline-none font-mono text-xs text-text resize-none"
                            placeholder={'services:\n  web:\n    image: nginx\n    ports:\n      - "8080:80"'}
                        />
                    </label>
                    {error && <p className="text-xs text-error" role="alert">{error}</p>}
                </div>
                <div className="flex justify-end gap-2 px-5 py-3 border-t border-border/60">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:text-text">Cancel</button>
                    <button type="submit" disabled={!text.trim()} className="px-4 py-2 rounded-xl text-sm font-bold bg-accent text-black hover:brightness-110 disabled:opacity-40">Add project</button>
                </div>
            </form>
        </div>,
        document.body
    );
}
