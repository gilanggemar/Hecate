"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Repeat } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

export function LoopNode(props: NodeProps) {
    const d = props.data as any;
    const loopType = d.loopType || "count";
    const maxIterations = d.maxIterations || 3;
    const checkpointId = d.checkpointId || "";
    
    const nodes = useWorkflowBuilderStore(s => s.nodes);
    const updateNodeData = useWorkflowBuilderStore(s => s.updateNodeData);
    const checkpoints = nodes.filter(n => n.type === 'checkpoint');

    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.loop}
            icon={<Repeat size={14} />}
            sourceHandles={[
                { id: "loop_body", label: "Loop", position: 35 },
                { id: "done", label: "Done", position: 65 },
            ]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                        fontSize: 8, fontWeight: 600, textTransform: "uppercase",
                        padding: "1px 4px", borderRadius: 3,
                        background: `${NODE_ACCENTS.loop}15`,
                        color: NODE_ACCENTS.loop,
                    }}>
                        {loopType === "for_each" ? "FOR EACH" : `${maxIterations}×`}
                    </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 8, position: "absolute", right: -32, top: "50%", transform: "translateY(-50%)" }}>
                    <span style={{ color: NODE_ACCENTS.loop, fontWeight: 600 }}>LOOP →</span>
                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>DONE →</span>
                </div>
            </div>
            {checkpoints.length > 0 ? (
                <div className="nodrag nopan" style={{ marginTop: 6 }}>
                    <select
                        value={checkpointId}
                        onChange={(e) => updateNodeData(props.id, { checkpointId: e.target.value })}
                        style={{
                            background: "oklch(0.10 0.005 0 / 0.8)",
                            border: `1px solid ${NODE_ACCENTS.loop}40`,
                            borderRadius: 4,
                            color: "var(--text-primary)",
                            fontSize: 9,
                            padding: "2px 4px",
                            outline: "none",
                            width: "100%",
                            cursor: "pointer",
                        }}
                    >
                        <option value="">(Select Checkpoint)</option>
                        {checkpoints.map(cp => (
                            <option key={cp.id} value={cp.id}>{(cp.data as any).label || 'Checkpoint'}</option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="nodrag nopan" style={{ marginTop: 6 }}>
                    <select
                        disabled
                        style={{
                            background: "oklch(0.10 0.005 0 / 0.5)",
                            border: `1px solid ${NODE_ACCENTS.loop}20`,
                            borderRadius: 4,
                            color: "var(--text-muted)",
                            fontSize: 9,
                            padding: "2px 4px",
                            outline: "none",
                            width: "100%",
                            cursor: "not-allowed",
                        }}
                    >
                        <option value="">(Select Checkpoint)</option>
                    </select>
                    <div style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.2 }}>
                        Add a Checkpoint node to the canvas to use as a cycle destination.
                    </div>
                </div>
            )}
        </BaseNodeV2>
    );
}
