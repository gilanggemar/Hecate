"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function ConditionNodeV2(props: NodeProps) {
    const expression = (props.data as any).expression || "";
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.condition}
            icon={<GitBranch size={14} />}
            sourceHandles={[
                { id: "true", label: "Yes", position: 35 },
                { id: "false", label: "No", position: 65 },
            ]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {expression && (
                    <div style={{
                        fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace",
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", maxWidth: 180,
                    }}>
                        {expression}
                    </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 8, position: "absolute", right: -28, top: "50%", transform: "translateY(-50%)" }}>
                    <span style={{ color: "var(--status-online)", fontWeight: 600 }}>YES →</span>
                    <span style={{ color: "var(--status-error)", fontWeight: 600 }}>NO →</span>
                </div>
            </div>
        </BaseNodeV2>
    );
}
