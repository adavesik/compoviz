import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Network } from 'lucide-react';

/**
 * Custom node for Docker networks in the visual builder.
 * Circular styling to differentiate from services.
 */
const NetworkNode = memo(({ data, selected }) => {
    const { name, driver = 'bridge', external = false, suggestionCount = 0, suggestionSeverity = null } = data;

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
                {suggestionCount > 0 && (
                    <span className={`suggestion-badge severity-${suggestionSeverity}`} title={`${suggestionCount} suggestion${suggestionCount > 1 ? 's' : ''} - Click node to view details`}>{suggestionCount}</span>
                )}
                <span className="node-subtitle">{external ? 'external' : driver}</span>
            </div>
        </div>
    );
});

NetworkNode.displayName = 'NetworkNode';

export default NetworkNode;
