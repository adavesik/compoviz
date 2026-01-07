import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Key } from 'lucide-react';

/**
 * Custom node for Docker secrets in the visual builder.
 */
const SecretNode = memo(({ data, selected }) => {
    const { name, file, external = false } = data;

    return (
        <div className={`builder-node secret-node ${selected ? 'selected' : ''}`}>
            {/* Target handle - services connect here */}
            <Handle
                type="target"
                position={Position.Left}
                className="builder-handle"
                id="services"
            />

            <div className="node-content">
                <Key size={20} className="node-icon" />
                <span className="node-title">{name}</span>
                <span className="node-subtitle">
                    {external ? 'external' : (file ? 'file' : 'secret')}
                </span>
            </div>
        </div>
    );
});

SecretNode.displayName = 'SecretNode';

export default SecretNode;
