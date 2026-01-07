import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Network } from 'lucide-react';

/**
 * Custom node for Docker networks in the visual builder.
 * Circular styling to differentiate from services.
 */
const NetworkNode = memo(({ data, selected }) => {
    const { name, driver = 'bridge', external = false } = data;

    return (
        <div className={`builder-node network-node ${selected ? 'selected' : ''}`}>
            {/* Target handle - services connect here */}
            <Handle
                type="target"
                position={Position.Left}
                className="builder-handle"
                id="services"
            />

            <div className="node-content">
                <Network size={20} className="node-icon" />
                <span className="node-title">{name}</span>
                <span className="node-subtitle">
                    {external ? 'external' : driver}
                </span>
            </div>
        </div>
    );
});

NetworkNode.displayName = 'NetworkNode';

export default NetworkNode;
