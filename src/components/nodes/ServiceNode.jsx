import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Heart, FileText, Globe, RotateCcw } from 'lucide-react';
import { getServiceIcon, renderServiceIcon } from '../../utils/iconUtils.jsx';

/**
 * Service node — shows image, ports, restart policy, health, network count.
 * Handles hidden at rest, visible on hover.
 */
const ServiceNode = memo(({ data, selected }) => {
    const {
        name,
        image,
        ports = [],
        hasHealthcheck,
        hasEnvFile,
        networks = [],
        restart,
        container_name,
        suggestionCount = 0,
        suggestionSeverity = null,
    } = data;

    const portDisplay = ports.slice(0, 2).map(p => {
        if (typeof p === 'string') {
            const parts = p.split(':');
            return parts[0];
        }
        return p.published || p;
    }).join(', ');

    const iconData = getServiceIcon(name, image);

    return (
        <div className={`builder-node service-node node-animate ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} className="builder-handle node-handle-hidden" id="deps-in" />

            {/* Header */}
            <div className="node-header service-header">
                {renderServiceIcon(iconData, 'node-icon')}
                <span className="node-title ml-1">{name}</span>
                {suggestionCount > 0 && (
                    <span
                        className={`suggestion-badge severity-${suggestionSeverity}`}
                        title={`${suggestionCount} suggestion${suggestionCount > 1 ? 's' : ''}`}
                    >
                        {suggestionCount}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="node-body">
                {image && (
                    <div className="node-field">
                        <span className="field-label">image</span>
                        <span className="field-value">{image}</span>
                    </div>
                )}

                {container_name && (
                    <div className="node-field">
                        <span className="field-label">name</span>
                        <span className="field-value">{container_name}</span>
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
                    {restart && restart !== 'no' && (
                        <span className="indicator" title={`Restart: ${restart}`}>
                            <RotateCcw size={11} />
                        </span>
                    )}
                    {hasHealthcheck && (
                        <span className="indicator indicator-active" title="Has healthcheck">
                            <Heart size={11} />
                        </span>
                    )}
                    {hasEnvFile && (
                        <span className="indicator" title="Has env file">
                            <FileText size={11} />
                        </span>
                    )}
                    {networks.length > 0 && (
                        <span className="indicator" title={`Networks: ${networks.join(', ')}`}>
                            <Globe size={11} />
                            <span className="indicator-count">{networks.length}</span>
                        </span>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} className="builder-handle node-handle-hidden" id="deps-out" />
            <Handle type="source" position={Position.Right} className="builder-handle handle-right node-handle-hidden" id="resources" />
        </div>
    );
});

ServiceNode.displayName = 'ServiceNode';

export default ServiceNode;
