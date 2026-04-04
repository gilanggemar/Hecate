'use client';

// edges/DelegationEdge.tsx
// Dual-mode edge routing:
// • Hierarchy edges (CEO → agent): Solid smooth-step paths
// • Inter-agent edges: Dotted bezier arcs curving below

import { memo, useMemo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { RelationshipType } from '@/lib/constellation/agentSchema';

const EDGE_COLORS: Record<RelationshipType, string> = {
    delegation: '#f97316',    // orange
    collaboration: '#22d3ee', // cyan
    handoff: '#a78bfa',       // violet
    advisory: '#64748b',      // slate
};

interface DelegationEdgeData {
    type: RelationshipType;
    label: string;
    isHierarchy?: boolean;
}

function DelegationEdgeComponent({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
}: EdgeProps & { data: DelegationEdgeData }) {
    const relType = data?.type || 'advisory';
    const color = EDGE_COLORS[relType];
    const isHierarchy = data?.isHierarchy ?? false;

    const [edgePath, labelX, labelY] = useMemo(() => {
        if (isHierarchy) {
            // Hierarchy: gentle bezier curve
            return getBezierPath({
                sourceX,
                sourceY,
                targetX,
                targetY,
                sourcePosition,
                targetPosition,
                curvature: 0.2,
            });
        } else {
            // Inter-agent: bezier arc curving below the row
            const horizontalDist = Math.abs(sourceX - targetX);
            const arcDepth = Math.min(100, 30 + horizontalDist * 0.06);

            const path = `M ${sourceX},${sourceY} C ${sourceX},${sourceY + arcDepth} ${targetX},${targetY + arcDepth} ${targetX},${targetY}`;
            const lx = (sourceX + targetX) / 2;
            const ly = Math.max(sourceY, targetY) + arcDepth * 0.5;

            return [path, lx, ly] as const;
        }
    }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, isHierarchy]);

    return (
        <>
            {/* Glow — subtle, only on selection or hierarchy */}
            {(selected || isHierarchy) && (
                <BaseEdge
                    id={`${id}-glow`}
                    path={edgePath}
                    style={{
                        stroke: color,
                        strokeWidth: 4,
                        strokeOpacity: selected ? 0.12 : 0.05,
                        filter: 'blur(3px)',
                    }}
                />
            )}

            {/* Main edge */}
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    stroke: color,
                    strokeWidth: selected ? 2 : 1.5,
                    strokeOpacity: selected ? 1 : isHierarchy ? 0.5 : 0.15,
                    strokeDasharray: isHierarchy ? 'none' : '4 3',
                    transition: 'stroke-opacity 0.3s, stroke-width 0.3s',
                }}
            />

            {/* Directional dot — only on hierarchy lines */}
            {isHierarchy && (
                <circle r="1.5" fill={color} opacity="0.3">
                    <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
                </circle>
            )}

            {/* Label — visible only on selection */}
            {data?.label && selected && (
                <foreignObject
                    x={labelX - 70}
                    y={labelY - 10}
                    width={140}
                    height={22}
                    className="pointer-events-none"
                >
                    <div className="flex items-center justify-center h-full">
                        <span
                            className="text-[7px] font-mono px-2 py-0.5 rounded-sm whitespace-nowrap max-w-[136px] truncate"
                            style={{
                                background: 'rgba(0,0,0,0.9)',
                                color,
                                border: `1px solid ${color}25`,
                            }}
                        >
                            {data.label}
                        </span>
                    </div>
                </foreignObject>
            )}
        </>
    );
}

export const DelegationEdge = memo(DelegationEdgeComponent);
