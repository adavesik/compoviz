import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Key } from 'lucide-react';

const SecretNode = memo(({ data, selected }) => {
    const { name, file, external = false } = data;

    return (
        <div className={`builder-node secret-node node-animate ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Left} className="builder-handle node-handle-hidden" id="services" />

            <div className="node-content">
                <Key size={18} className="node-icon" />
                <span className="node-title">{name}</span>
                <span className="node-subtitle">{external ? 'external' : (file ? 'file' : 'secret')}</span>
            </div>
        </div>
    );
});

SecretNode.displayName = 'SecretNode';
export default SecretNode;
