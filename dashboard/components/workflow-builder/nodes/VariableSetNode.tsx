"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Wrench } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function VariableSetNode(props: NodeProps) {
    const d = props.data as any;
    const varName = d.variableName || "";
    const varValue = d.variableValue || "";

    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.variable_set}
            icon={<Wrench size={14} />}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                {varName && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{
                            fontSize: 9, fontWeight: 600, fontFamily: "monospace",
                            color: NODE_ACCENTS.variable_set,
                            background: `oklch(0.75 0.12 200 / 0.12)`,
                            padding: "1px 4px", borderRadius: 3,
                        }}>
                            {varName}
                        </span>
                        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>=</span>
                    </div>
                )}
                {varValue && (
                    <div style={{
                        fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace",
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", maxWidth: 170,
                    }}>
                        {varValue}
                    </div>
                )}
                {!varName && !varValue && (
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Set a variable</div>
                )}
            </div>
        </BaseNodeV2>
    );
}
