import React from 'react';
import { Server, Network, Database, Key, FileText, Plus, Trash2, AlertCircle } from 'lucide-react';
import { Badge, IconButton } from '../../components/ui';

/**
 * Resource tree navigation component for sidebar
 * Displays all compose resources in a hierarchical tree
 */
export const ResourceTree = ({ state, selected, onSelect, onAdd, onDelete, errors, searchTerm }) => {
    const categories = [
        { key: 'services', label: 'Services', icon: Server, color: 'text-cyber-accent' },
        { key: 'networks', label: 'Networks', icon: Network, color: 'text-cyber-success' },
        { key: 'volumes', label: 'Volumes', icon: Database, color: 'text-cyber-warning' },
        { key: 'secrets', label: 'Secrets', icon: Key, color: 'text-cyber-purple' },
        { key: 'configs', label: 'Configs', icon: FileText, color: 'text-cyber-cyan' },
    ];

    const getErrors = (type, name) => errors.filter(e => e.entity === type.slice(0, -1) && e.name === name);
    const filter = (items) => searchTerm
        ? Object.keys(items).filter(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
        : Object.keys(items);

    return (
        <div className="space-y-2">
            {categories.map(({ key, label, icon: Icon, color }) => (
                <div key={key}>
                    <div className="flex items-center justify-between px-3 py-2 text-sm font-medium text-cyber-text-muted">
                        <span className="flex items-center gap-2"><Icon size={14} className={color} />{label}</span>
                        <button onClick={() => onAdd(key)} className="p-1 hover:bg-cyber-surface-light rounded transition-colors">
                            <Plus size={14} />
                        </button>
                    </div>
                    {filter(state[key]).map(name => {
                        const itemErrors = getErrors(key, name);
                        return (
                            <div
                                key={name}
                                className={`tree-item ml-2 ${selected?.type === key && selected?.name === name ? 'active' : ''}`}
                                onClick={() => onSelect({ type: key, name })}
                            >
                                <Icon size={14} className={color} />
                                <span className="flex-1 truncate text-sm">{name}</span>
                                {itemErrors.length > 0 && <Badge type={itemErrors[0].type}>{itemErrors.length}</Badge>}
                                <IconButton
                                    icon={Trash2}
                                    onClick={e => { e.stopPropagation(); onDelete(key, name); }}
                                    variant="danger"
                                    size="sm"
                                />
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default ResourceTree;
