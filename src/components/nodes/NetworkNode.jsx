import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Network } from 'lucide-react';

const NetworkNode = memo(({ data, selected }) => {
    const { name, driver = 'bridge', external = false, suggestionCount = 0, suggestionSeverity = null } = data;

    return (
        <div className={`builder-node network-node node-animate ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Left} className="builder-handle node-handle-hidden" id="services" />

            <div className="node-content">
                <Network size={18} className="node-icon" />
                <span className="node-title">{name}</span>
                {suggestionCount > 0 && (
                    <span className={`suggestion-badge severity-${suggestionSeverity}`} title={`${suggestionCount} suggestion${suggestionCount > 1 ? 's' : ''}`}>{suggestionCount}</span>
                )}
                <span className="node-subtitle">{external ? 'external' : driver}</span>
            </div>
        </div>
    );
});

NetworkNode.displayName = 'NetworkNode';
export default NetworkNode;
