import React, { memo } from 'react';
import { Server, Network, Database, Key, FileText } from 'lucide-react';

/**
 * Draggable toolbar for adding new resources to the canvas.
 */
const BuilderToolbar = memo(({ onAdd }) => {
    const items = [
        { type: 'services', label: 'Service', icon: Server, color: 'text-accent' },
        { type: 'networks', label: 'Network', icon: Network, color: 'text-success' },
        { type: 'volumes', label: 'Volume', icon: Database, color: 'text-warning' },
        { type: 'secrets', label: 'Secret', icon: Key, color: 'text-secret' },
        { type: 'configs', label: 'Config', icon: FileText, color: 'text-cyan-400' },
    ];

    const onDragStart = (event, type) => {
        event.dataTransfer.setData('application/reactflow', type);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="builder-toolbar">
            <div className="toolbar-label">Drag to add</div>
            <div className="toolbar-items">
                {items.map(({ type, label, icon: Icon, color }) => (
                    <div
                        key={type}
                        className="toolbar-item"
                        draggable
                        onDragStart={(e) => onDragStart(e, type)}
                        onClick={() => onAdd(type)}
                    >
                        <Icon size={18} className={color} />
                        <span>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

BuilderToolbar.displayName = 'BuilderToolbar';

export default BuilderToolbar;
