"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Merge } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function ConvergenceNode(props: NodeProps) {
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.convergence}
            icon={<Merge size={14} />}
            targetHandleStyle={{
                borderRadius: 2,
                height: 40,
                width: 6,
                background: NODE_ACCENTS.convergence,
                border: "none",
                left: -3,
            }}
        >
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4 }}>
                Accepts multiple inputs
            </div>
        </BaseNodeV2>
    );
}
