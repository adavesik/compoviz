import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Collapsible section with colored accent border
 * @param {string} accentColor - CSS color for the left border accent (optional)
 */
export const Section = ({ title, icon: Icon, children, defaultOpen = true, accentColor }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div
            className="section-card rounded-lg overflow-hidden"
            style={open && accentColor ? { borderLeftColor: accentColor } : undefined}
        >
            <button
                type="button"
                className="section-header w-full"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
            >
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon size={15} style={accentColor ? { color: accentColor } : undefined} className={accentColor ? '' : 'text-accent'} />
                    {title}
                </div>
                <div className={`section-chevron ${open ? 'section-chevron-open' : ''}`}>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
            </button>
            {open && (
                <div className="section-body animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

export default Section;
