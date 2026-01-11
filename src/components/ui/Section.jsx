import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Collapsible section component
 * @param {string} title - Section title
 * @param {React.ComponentType} icon - Section icon
 * @param {React.ReactNode} children - Section content
 * @param {boolean} defaultOpen - Whether section is open by default
 */
export const Section = ({ title, icon: Icon, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="border border-cyber-border/50 rounded-lg overflow-hidden">
            <div className="collapsible-header" onClick={() => setOpen(!open)}>
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon size={16} className="text-cyber-accent" />
                    {title}
                </div>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {open && <div className="p-4 space-y-3 animate-fade-in">{children}</div>}
        </div>
    );
};

export default Section;
