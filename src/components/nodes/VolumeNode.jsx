import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';

/**
 * Custom node for Docker volumes in the visual builder.
 * Cylinder/database styling.
 */
const VolumeNode = memo(({ data, selected }) => {
    const { name, driver = 'local', external = false } = data;

    return (
        <div className={`builder-node volume-node ${selected ? 'selected' : ''}`}>
            {/* Target handle - services connect here */}
            <Handle
                type="target"
                position={Position.Left}
                className="builder-handle"
                id="services"
            />

            <div className="node-content">
                <Database size={20} className="node-icon" />
                <span className="node-title">{name}</span>
                <span className="node-subtitle">
                    {external ? 'external' : driver}
                </span>
            </div>
        </div>
    );
});

VolumeNode.displayName = 'VolumeNode';

export default VolumeNode;
