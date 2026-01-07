import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

/**
 * Custom edge for depends_on relationships.
 * Animated solid line with condition label.
 */
const DependsOnEdge = memo(({
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

    const condition = data?.condition || 'service_started';
    const shortCondition = condition.replace('service_', '');

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                className={`depends-on-edge ${selected ? 'selected' : ''}`}
                style={{
                    stroke: '#f472b6',
                    strokeWidth: selected ? 3 : 2,
                }}
            />
            <EdgeLabelRenderer>
                <div
                    className="edge-label depends-on-label"
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                >
                    {shortCondition}
                </div>
            </EdgeLabelRenderer>
        </>
    );
});

DependsOnEdge.displayName = 'DependsOnEdge';

export default DependsOnEdge;
