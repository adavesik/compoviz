import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';

/**
 * Custom node for Docker configs in the visual builder.
 */
const ConfigNode = memo(({ data, selected }) => {
    const { name, file, external = false } = data;

    return (
        <div className={`builder-node config-node ${selected ? 'selected' : ''}`}>
            {/* Target handle - services connect here */}
            <Handle
                type="target"
                position={Position.Left}
                className="builder-handle"
                id="services"
            />

            <div className="node-content">
                <FileText size={20} className="node-icon" />
                <span className="node-title">{name}</span>
                <span className="node-subtitle">
                    {external ? 'external' : (file ? 'file' : 'config')}
                </span>
            </div>
        </div>
    );
});

ConfigNode.displayName = 'ConfigNode';

export default ConfigNode;
