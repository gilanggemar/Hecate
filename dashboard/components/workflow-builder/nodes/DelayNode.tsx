"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Timer } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function DelayNode(props: NodeProps) {
    const d = props.data as any;
    const delaySec = d.delaySec || 5;
    const unit = delaySec >= 60 ? "min" : "sec";
    const display = delaySec >= 60 ? Math.round(delaySec / 60) : delaySec;

    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.delay}
            icon={<Timer size={14} />}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{
                    fontSize: 16, fontWeight: 700, color: NODE_ACCENTS.delay,
                    fontVariantNumeric: "tabular-nums",
                }}>
                    {display}
                </span>
                <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    {unit}
                </span>
            </div>
        </BaseNodeV2>
    );
}
