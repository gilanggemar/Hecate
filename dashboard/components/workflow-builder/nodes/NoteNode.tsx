"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { StickyNote } from "lucide-react";
import { NODE_ACCENTS, NODE_DIMENSIONS, getHandleStyle } from "./nodeStyles";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

export function NoteNode(props: NodeProps) {
    const { id, data, selected } = props;
    const noteText = (data as any).noteText || "";
    const accent = NODE_ACCENTS.note;

    return (
        <div
            style={{
                minWidth: 160,
                maxWidth: 240,
                padding: 12,
                borderRadius: 10,
                background: "oklch(0.16 0.02 80 / 0.75)",
                backdropFilter: "blur(8px)",
                border: `1.5px dashed ${selected ? accent : "oklch(1 0 0 / 0.12)"}`,
                boxShadow: selected
                    ? `0 0 12px ${accent}30`
                    : "0 2px 10px oklch(0 0 0 / 0.15)",
                transition: "all 200ms ease",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <StickyNote size={12} style={{ color: accent, flexShrink: 0 }} />
                <span style={{
                    fontSize: 9, fontWeight: 600, textTransform: "uppercase",
                    letterSpacing: "0.05em", color: accent,
                }}>
                    Note
                </span>
            </div>
            <div style={{
                fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
                {noteText || "Double-click to add a note…"}
            </div>
        </div>
    );
}
