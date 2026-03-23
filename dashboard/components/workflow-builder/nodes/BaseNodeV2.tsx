"use client";

import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Info } from "lucide-react";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";
import {
    NODE_ACCENTS,
    NODE_DIMENSIONS,
    EXEC_STATUS_COLORS,
    getHandleStyle,
    type WfNodeType,
    NODE_INFO,
} from "./nodeStyles";

interface BaseNodeV2Props {
    nodeProps: NodeProps;
    accent: string;
    icon: React.ReactNode;
    showSourceHandle?: boolean;
    showTargetHandle?: boolean;
    targetHandleStyle?: React.CSSProperties;
    /** For condition node: named source handles */
    sourceHandles?: { id: string; label: string; position: number }[];
    children?: React.ReactNode;
}

export function BaseNodeV2({
    nodeProps,
    accent,
    icon,
    showSourceHandle = true,
    showTargetHandle = true,
    targetHandleStyle,
    sourceHandles,
    children,
}: BaseNodeV2Props) {
    const { id, data, selected } = nodeProps;
    const label = (data as any).label || id;
    const executionState = useWorkflowBuilderStore((s) => s.executionState);
    const toggleNodeFreeze = useWorkflowBuilderStore((s) => s.toggleNodeFreeze);
    const execStatus = executionState[id] || "idle";
    const statusColor = EXEC_STATUS_COLORS[execStatus];
    const isRunning = execStatus === "running";
    const isFrozen = !!(data as any).isFrozen;

    return (
        <div
            style={{
                minWidth: NODE_DIMENSIONS.minWidth,
                padding: NODE_DIMENSIONS.padding,
                borderRadius: NODE_DIMENSIONS.borderRadius,
                background: "oklch(0.13 0.005 0 / 0.85)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: isRunning ? `2px solid ${accent}` : `1.5px solid ${selected ? accent : "oklch(1 0 0 / 0.08)"}`,
                boxShadow: isRunning
                    ? `0 0 15px ${accent}80, 0 0 30px ${accent}60, 0 4px 20px oklch(0 0 0 / 0.3)`
                    : selected
                    ? `0 0 15px ${accent}40, 0 4px 20px oklch(0 0 0 / 0.3)`
                    : "0 4px 20px oklch(0 0 0 / 0.2)",
                transition: "all 300ms ease",
                position: "relative",
            }}
        >
            {/* Info Tooltip Icon */}
            {NODE_INFO[nodeProps.type as WfNodeType] && (
                <div
                    className="group"
                    style={{
                        position: "absolute",
                        top: -8,
                        left: -8,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "oklch(0.18 0.005 0)",
                        border: `1px solid ${accent}60`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                        cursor: "help",
                        zIndex: 10,
                        boxShadow: `0 2px 8px oklch(0 0 0 / 0.5)`,
                    }}
                >
                    <Info size={11} />
                    <div
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                        style={{
                            position: "absolute",
                            bottom: "100%",
                            left: "50%",
                            transform: "translateX(-20px)",
                            marginBottom: 8,
                            width: 240,
                            padding: "10px 14px",
                            background: "oklch(0.15 0.005 0 / 0.95)",
                            backdropFilter: "blur(8px)",
                            border: "1px solid oklch(1 0 0 / 0.15)",
                            borderRadius: 8,
                            boxShadow: "0 10px 40px oklch(0 0 0 / 0.8)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            zIndex: 100,
                        }}
                    >
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>
                            {NODE_INFO[nodeProps.type as WfNodeType].description}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                            {NODE_INFO[nodeProps.type as WfNodeType].tips}
                        </div>
                        <div style={{
                            position: "absolute", bottom: -5, left: 16, width: 10, height: 10,
                            background: "oklch(0.15 0.005 0)", borderRight: "1px solid oklch(1 0 0 / 0.15)",
                            borderBottom: "1px solid oklch(1 0 0 / 0.15)", transform: "rotate(45deg)"
                        }} />
                    </div>
                </div>
            )}

            {/* Execution status indicator */}
            {execStatus !== "idle" && (
                <div
                    style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: statusColor,
                        animation: isRunning ? "wf-pulse 1.5s ease-in-out infinite" : undefined,
                    }}
                />
            )}

            {/* Frozen status indicator / Toggle */}
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeFreeze(id);
                }}
                style={{
                    position: "absolute",
                    top: 4,
                    right: execStatus !== "idle" ? 16 : 6,
                    color: "oklch(0.8 0.1 230)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isFrozen ? 1 : 0.1,
                    cursor: "pointer",
                    transition: "opacity 150ms",
                }}
                onMouseEnter={(e) => {
                    if (!isFrozen) {
                        e.currentTarget.style.opacity = "0.5";
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isFrozen) {
                        e.currentTarget.style.opacity = "0.1";
                    }
                }}
                title={isFrozen ? "Node Output Frozen" : "Freeze Node Output"}
            >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <line x1="12" y1="2" x2="12" y2="22"></line>
                    <path d="m20 16-4-4 4-4"></path>
                    <path d="m4 8 4 4-4 4"></path>
                    <path d="m16 4-4 4-4-4"></path>
                    <path d="m8 20 4-4 4 4"></path>
                </svg>
            </div>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: children ? 8 : 0 }}>
                <div
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: `${accent}20`,
                        color: accent,
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {label}
                    </div>
                </div>
            </div>

            {children}

            {/* Handles */}
            {showTargetHandle && (
                <Handle
                    type="target"
                    position={Position.Left}
                    style={{ ...getHandleStyle(accent), ...targetHandleStyle }}
                />
            )}

            {sourceHandles ? (
                sourceHandles.map((h) => (
                    <Handle
                        key={h.id}
                        type="source"
                        position={Position.Right}
                        id={h.id}
                        style={{
                            ...getHandleStyle(accent),
                            top: `${h.position}%`,
                        }}
                    />
                ))
            ) : showSourceHandle ? (
                <Handle
                    type="source"
                    position={Position.Right}
                    style={getHandleStyle(accent)}
                />
            ) : null}
        </div>
    );
}
