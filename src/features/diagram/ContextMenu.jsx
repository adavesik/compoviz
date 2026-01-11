import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Server, Network, Database, Key, FileText, Plus } from 'lucide-react';

/**
 * Context menu for adding resources in diagram view
 */
export const ContextMenu = ({ x, y, onClose, onAdd }) => {
    const menuRef = useRef(null);

    // Close on click outside or escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const items = [
        { key: 'services', label: 'Add Service', icon: Server, color: 'text-cyber-accent' },
        { key: 'networks', label: 'Add Network', icon: Network, color: 'text-cyber-success' },
        { key: 'volumes', label: 'Add Volume', icon: Database, color: 'text-cyber-warning' },
        { key: 'secrets', label: 'Add Secret', icon: Key, color: 'text-cyber-purple' },
        { key: 'configs', label: 'Add Config', icon: FileText, color: 'text-cyber-cyan' },
    ];

    // Adjust position to keep menu in viewport
    const adjustedX = Math.min(x, window.innerWidth - 200);
    const adjustedY = Math.min(y, window.innerHeight - 280);

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] glass rounded-xl py-2 shadow-xl animate-fade-in min-w-[180px] border border-cyber-border/50"
            style={{ left: adjustedX, top: adjustedY }}
        >
            <div className="px-3 py-1.5 text-xs text-cyber-text-muted uppercase tracking-wide border-b border-cyber-border/30 mb-1">
                Quick Add
            </div>
            {items.map(({ key, label, icon: Icon, color }) => (
                <button
                    key={key}
                    onClick={() => { onAdd(key); onClose(); }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-cyber-surface-light transition-colors text-left group"
                >
                    <Icon size={16} className={color} />
                    <span className="text-sm group-hover:text-cyber-accent transition-colors">{label}</span>
                    <Plus size={12} className="ml-auto text-cyber-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            ))}
        </div>,
        document.body
    );
};

export default ContextMenu;
