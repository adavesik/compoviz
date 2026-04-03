import { useState, useCallback, memo } from 'react';
import { X, Server, Network, Database, Key, FileText, Trash2, Box, AlertCircle, Info } from 'lucide-react';

// Import config components
import { ServiceConfig, NetworkConfig, VolumeConfig, SecretConfig, ConfigConfig } from '../features/visual-builder/configs';

/**
 * Comprehensive Node Configuration Panel for the Visual Builder.
 * Provides ALL available Docker Compose options for each resource type.
 */
const NodeConfigPanel = memo(({
    nodeType, // 'service' | 'network' | 'volume' | 'secret' | 'config'
    nodeName,
    nodeData,
    allNetworks = {},
    allServices = {},
    allVolumes = {},
    allSecrets = {},
    allConfigs = {},
    suggestions = [],
    suggestionsEnabled = true,
    onUpdate,
    onClose,
    onDelete,
    onRename,
}) => {
    const [localData, setLocalData] = useState(nodeData || {});
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(nodeName);


    // Update local state and propagate to parent
    const update = useCallback((field, value) => {
        const newData = { ...localData, [field]: value };
        setLocalData(newData);
        onUpdate?.(newData);
    }, [localData, onUpdate]);

    // Update multiple fields at once
    const updateMulti = useCallback((updates) => {
        const newData = { ...localData, ...updates };
        setLocalData(newData);
        onUpdate?.(newData);
    }, [localData, onUpdate]);

    // Update nested fields
    const updateNested = useCallback((path, value) => {
        const keys = path.split('.');
        const newData = JSON.parse(JSON.stringify(localData));
        let obj = newData;
        keys.slice(0, -1).forEach(k => { if (!obj[k]) obj[k] = {}; obj = obj[k]; });
        obj[keys[keys.length - 1]] = value;
        setLocalData(newData);
        onUpdate?.(newData);
    }, [localData, onUpdate]);

    const handleRename = () => {
        if (newName && newName !== nodeName) {
            onRename?.(newName);
        }
        setIsRenaming(false);
    };

    // Get icon and color for node type
    const getNodeTypeInfo = () => {
        switch (nodeType) {
            case 'service': return { icon: Server, color: 'text-accent', bgColor: 'bg-accent/20' };
            case 'network': return { icon: Network, color: 'text-success', bgColor: 'bg-success/20' };
            case 'volume': return { icon: Database, color: 'text-warning', bgColor: 'bg-warning/20' };
            case 'secret': return { icon: Key, color: 'text-secret', bgColor: 'bg-secret/20' };
            case 'config': return { icon: FileText, color: 'text-cyan-400', bgColor: 'bg-cyan-400/20' };
            default: return { icon: Box, color: 'text-text-secondary', bgColor: 'bg-surface-raised' };
        }
    };

    const { icon: TypeIcon, color, bgColor } = getNodeTypeInfo();

    // Render the appropriate config component based on node type
    const renderConfig = () => {
        switch (nodeType) {
            case 'service':
                return (
                    <ServiceConfig
                        data={localData}
                        update={update}
                        updateNested={updateNested}
                        allNetworks={allNetworks}
                        allServices={allServices}
                        allVolumes={allVolumes}
                        allSecrets={allSecrets}
                        allConfigs={allConfigs}
                        nodeName={nodeName}
                    />
                );
            case 'network':
                return (
                    <NetworkConfig
                        data={localData}
                        update={update}
                        updateNested={updateNested}
                    />
                );
            case 'volume':
                return (
                    <VolumeConfig
                        data={localData}
                        update={update}
                        updateNested={updateNested}
                    />
                );
            case 'secret':
                return (
                    <SecretConfig
                        data={localData}
                        update={update}
                        updateMulti={updateMulti}
                    />
                );
            case 'config':
                return (
                    <ConfigConfig
                        data={localData}
                        update={update}
                        updateMulti={updateMulti}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="node-config-panel">
            {/* Header */}
            <div className="config-panel-header">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${bgColor}`}>
                        <TypeIcon size={20} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                        {isRenaming ? (
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                className="text-lg font-semibold bg-transparent border-b border-accent focus:outline-none w-full"
                                autoFocus
                            />
                        ) : (
                            <h2
                                className="text-lg font-semibold cursor-pointer hover:text-accent transition-colors truncate"
                                onClick={() => setIsRenaming(true)}
                                title="Click to rename"
                            >
                                {nodeName}
                            </h2>
                        )}
                        <p className="text-xs text-text-secondary capitalize">{nodeType}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onDelete?.(nodeType, nodeName)}
                        className="p-2 rounded-lg text-text-secondary hover:text-error hover:bg-error/20 transition-all"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                    {/* Close button - more prominent on mobile with "Done" text */}
                    <button
                        onClick={onClose}
                        className="p-2 md:p-2 rounded-lg text-text-secondary hover:text-text hover:bg-surface-raised transition-all flex items-center gap-1"
                    >
                        <span className="md:hidden text-sm text-accent font-medium">Done</span>
                        <X size={18} className="hidden md:block" />
                    </button>
                </div>
            </div>

            {/* Content based on node type */}
            <div className="config-panel-content">
                {/* Suggestions Section */}
                {suggestionsEnabled && suggestions.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-surface border border-border">
                        <h3 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                            <AlertCircle size={16} className="text-warning" />
                            Suggestions ({suggestions.length})
                        </h3>
                        <div className="space-y-2">
                            {suggestions.map((suggestion, idx) => (
                                <div
                                    key={idx}
                                    className={`p-2 rounded border-l-2 text-xs ${suggestion.severity === 'critical' ? 'border-error bg-error/5' :
                                            suggestion.severity === 'high' ? 'border-error/80 bg-error/5' :
                                                suggestion.severity === 'medium' ? 'border-warning bg-warning/5' :
                                                    suggestion.severity === 'low' ? 'border-accent bg-accent/5' :
                                                        'border-text-secondary bg-surface-raised'
                                        }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <Info size={12} className="mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-text">{suggestion.message}</p>
                                            {suggestion.category && (
                                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-surface text-text-secondary capitalize">
                                                    {suggestion.category.replace('-', ' ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {renderConfig()}
            </div>
        </div>
    );
});

NodeConfigPanel.displayName = 'NodeConfigPanel';

export default NodeConfigPanel;
