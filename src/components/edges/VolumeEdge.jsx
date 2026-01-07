import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

/**
 * Custom edge for volume mounts.
 * Dotted amber line with mount path label.
 */
const VolumeEdge = memo(({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
}) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
    });

    const mountPath = data?.mountPath;

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                className={`volume-edge ${selected ? 'selected' : ''}`}
                style={{
                    stroke: '#fbbf24',
                    strokeWidth: selected ? 2.5 : 1.5,
                    strokeDasharray: '2 2',
                }}
            />
            {mountPath && (
                <EdgeLabelRenderer>
                    <div
                        className="edge-label volume-label"
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'all',
                        }}
                    >
                        {mountPath}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
});

VolumeEdge.displayName = 'VolumeEdge';

export default VolumeEdge;
