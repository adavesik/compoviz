import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Server, Heart, FileText, Globe } from 'lucide-react';

/**
 * Custom node for Docker services in the visual builder.
 * Shows service name, image, ports, and status indicators.
 */
const ServiceNode = memo(({ data, selected }) => {
    const { name, image, ports = [], hasHealthcheck, hasEnvFile, networks = [] } = data;

    // Format ports for display
    const portDisplay = ports.slice(0, 2).map(p => {
        if (typeof p === 'string') {
            const parts = p.split(':');
            return parts[0];
        }
        return p.published || p;
    }).join(', ');

    return (
        <div className={`builder-node service-node ${selected ? 'selected' : ''}`}>
            {/* Target handle (top) - for incoming dependencies */}
            <Handle
                type="target"
                position={Position.Top}
                className="builder-handle"
                id="deps-in"
            />

            {/* Header */}
            <div className="node-header service-header">
                <Server size={14} className="node-icon" />
                <span className="node-title">{name}</span>
            </div>

            {/* Body */}
            <div className="node-body">
                {image && (
                    <div className="node-field">
                        <span className="field-label">image</span>
                        <span className="field-value">{image}</span>
                    </div>
                )}

                {portDisplay && (
                    <div className="node-field">
                        <span className="field-label">ports</span>
                        <span className="field-value">{portDisplay}{ports.length > 2 ? ` +${ports.length - 2}` : ''}</span>
                    </div>
                )}

                {/* Status indicators */}
                <div className="node-indicators">
                    {hasHealthcheck && (
                        <span className="indicator" title="Has healthcheck">
                            <Heart size={12} />
                        </span>
                    )}
                    {hasEnvFile && (
                        <span className="indicator" title="Has env file">
                            <FileText size={12} />
                        </span>
                    )}
                    {networks.length > 0 && (
                        <span className="indicator" title={`Networks: ${networks.join(', ')}`}>
                            <Globe size={12} />
                            <span className="indicator-count">{networks.length}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Source handle (bottom) - for outgoing dependencies */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="builder-handle"
                id="deps-out"
            />

            {/* Side handles for networks/volumes */}
            <Handle
                type="source"
                position={Position.Right}
                className="builder-handle handle-right"
                id="resources"
            />
        </div>
    );
});

ServiceNode.displayName = 'ServiceNode';

export default ServiceNode;
