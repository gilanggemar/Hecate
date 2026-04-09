"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { ClipboardList } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function TaskCallNode(props: NodeProps) {
    const d = props.data as any;
    const agentName = d.agentName || "No agent";
    const taskTitle = d.taskTitle || "";
    const hasSystemPrompt = !!d.systemPromptOverride?.trim();

    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.task_call}
            icon={<ClipboardList size={14} />}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {/* Agent badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                        fontSize: 8, fontWeight: 600, textTransform: "uppercase",
                        padding: "1px 4px", borderRadius: 3,
                        background: "oklch(0.72 0.14 195 / 0.15)", color: "oklch(0.72 0.14 195)",
                    }}>
                        AGENT
                    </span>
                    <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>{agentName}</span>
                </div>
                {/* Task title */}
                {taskTitle ? (
                    <div style={{
                        fontSize: 9, color: "var(--text-muted)",
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        maxWidth: 180,
                    }}>
                        {taskTitle}
                    </div>
                ) : (
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>
                        No task selected
                    </div>
                )}
                {/* System prompt indicator */}
                {hasSystemPrompt && (
                    <div style={{
                        fontSize: 8, color: "oklch(0.78 0.12 55)",
                        display: "flex", alignItems: "center", gap: 3, marginTop: 1,
                    }}>
                        <span style={{
                            width: 4, height: 4, borderRadius: "50%",
                            background: "oklch(0.78 0.12 55)", flexShrink: 0,
                        }} />
                        Custom prompt active
                    </div>
                )}
            </div>
        </BaseNodeV2>
    );
}
