"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Flag } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

export function OutputNodeV2(props: NodeProps) {
    const outputMode = (props.data as any).outputMode || "return";
    const checkpointId = (props.data as any).checkpointId || "";
    
    const nodes = useWorkflowBuilderStore(s => s.nodes);
    const updateNodeData = useWorkflowBuilderStore(s => s.updateNodeData);
    const checkpoints = nodes.filter(n => n.type === 'checkpoint');
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.output}
            icon={<Flag size={14} />}
            showSourceHandle={false}
            showTargetHandle={true}
        >
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                {checkpointId ? "Cycles to Checkpoint" : (outputMode === "webhook" ? "Send to webhook" : outputMode === "notification" ? "Send to notification" : outputMode === "log" ? "Log output" : "Return result")}
            </div>

            {checkpoints.length > 0 ? (
                <div className="nodrag nopan" style={{ marginTop: 6 }}>
                    <select
                        value={checkpointId}
                        onChange={(e) => updateNodeData(props.id, { checkpointId: e.target.value })}
                        style={{
                            background: "oklch(0.10 0.005 0 / 0.8)",
                            border: `1px solid ${NODE_ACCENTS.output}40`,
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
                            border: `1px solid ${NODE_ACCENTS.output}20`,
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
