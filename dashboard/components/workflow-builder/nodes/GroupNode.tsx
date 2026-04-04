"use client";
import React from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import { Box, ChevronDown, ChevronRight, Maximize2 } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

function GroupNodeInner({ id, data, selected }: NodeProps) {
    const accent = NODE_ACCENTS.group;
    const hoveredGroupId = useWorkflowBuilderStore((s) => s.hoveredGroupId);
    const fitGroupToChildren = useWorkflowBuilderStore((s) => s.fitGroupToChildren);
    const isHovered = hoveredGroupId === id;
    const isCollapsed = (data.collapsed as boolean) || false;
    const label = (data.label as string) || "Group";

    const borderColor = isHovered
        ? "var(--accent-base)"
        : selected
            ? accent
            : "oklch(1 0 0 / 0.12)";

    const glowShadow = isHovered
        ? "0 0 20px oklch(0.75 0.18 55 / 0.35), 0 0 40px oklch(0.75 0.18 55 / 0.15)"
        : "none";

    return (
        <>
            <NodeResizer
                color={accent}
                isVisible={!!selected}
                minWidth={250}
                minHeight={isCollapsed ? 40 : 150}
            />
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    minWidth: 250,
                    minHeight: isCollapsed ? 40 : 150,
                    borderRadius: 6,
                    background: isHovered
                        ? "oklch(0.75 0.18 55 / 0.06)"
                        : "oklch(0.10 0.005 0 / 0.25)",
                    border: `1.5px dashed ${borderColor}`,
                    boxShadow: glowShadow,
                    transition: "border-color 200ms ease, background 200ms ease, box-shadow 200ms ease",
                    position: "relative",
                    pointerEvents: "none",
                }}
            >
                {/* Group header — only this is interactive */}
                <div
                    className="drag-handle"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "6px 10px",
                        borderBottom: isCollapsed ? "none" : "1px dashed oklch(1 0 0 / 0.06)",
                        cursor: "grab",
                        pointerEvents: "auto",
                    }}
                >
                    <Box size={12} style={{ color: isHovered ? "var(--accent-base)" : accent, flexShrink: 0 }} />
                    <span style={{
                        fontSize: 9, fontWeight: 600, color: "var(--text-secondary)",
                        textTransform: "uppercase", letterSpacing: "0.06em", flex: 1,
                    }}>
                        {label}
                    </span>

                    {/* Auto-fit button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            fitGroupToChildren(id);
                        }}
                        title="Auto-fit to children"
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 2,
                            color: "var(--text-muted)",
                            opacity: 0.5,
                            transition: "opacity 150ms, color 150ms",
                            display: "flex",
                            alignItems: "center",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = accent; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = "var(--text-muted)"; }}
                    >
                        <Maximize2 size={10} />
                    </button>

                    {isCollapsed ? <ChevronRight size={12} style={{ color: "var(--text-muted)" }} /> :
                        <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />}
                </div>
            </div>
        </>
    );
}

export const GroupNode = React.memo(GroupNodeInner);
