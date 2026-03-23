"use client";
import React, { useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { Users, Check, RefreshCw, X } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

export function HumanApprovalNode(props: NodeProps) {
    const instructions = (props.data as any).instructions || "";
    const executionState = useWorkflowBuilderStore((s) => s.executionState);
    const pendingGates = useWorkflowBuilderStore((s) => s.pendingGates);
    const approveGate = useWorkflowBuilderStore((s) => s.approveGate);
    const retryGate = useWorkflowBuilderStore((s) => s.retryGate);
    const declineGate = useWorkflowBuilderStore((s) => s.declineGate);

    const execStatus = executionState[props.id] || "idle";
    const isPending = execStatus === "waiting" && pendingGates.some(g => g.nodeId === props.id);

    const nodes = useWorkflowBuilderStore(s => s.nodes);
    const updateNodeData = useWorkflowBuilderStore(s => s.updateNodeData);
    const checkpoints = nodes.filter(n => n.type === 'checkpoint');
    const checkpointId = (props.data as any).checkpointId || "";

    const [reviewText, setReviewText] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const handleApprove = async () => {
        setActionLoading("approve");
        await approveGate(props.id, reviewText.trim() || undefined);
        setActionLoading(null);
        setReviewText("");
    };

    const handleRetry = async () => {
        setActionLoading("retry");
        await retryGate(props.id, reviewText.trim() || undefined);
        setActionLoading(null);
        setReviewText("");
    };

    const handleDecline = () => {
        declineGate(props.id);
        setReviewText("");
    };

    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.human_approval}
            icon={<Users size={14} />}
        >
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                {instructions || "Pauses for human approval"}
            </div>

            {checkpoints.length > 0 ? (
                <div className="nodrag nopan" style={{ marginTop: 6 }}>
                    <select
                        value={checkpointId}
                        onChange={(e) => updateNodeData(props.id, { checkpointId: e.target.value })}
                        style={{
                            background: "oklch(0.10 0.005 0 / 0.8)",
                            border: `1px solid ${NODE_ACCENTS.human_approval}40`,
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
                            border: `1px solid ${NODE_ACCENTS.human_approval}20`,
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

            {/* Approval panel — appears when execution is waiting on this node */}
            {isPending && (
                <div
                    style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        background: "oklch(0.10 0.005 0 / 0.9)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Instructions textarea */}
                    <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Reviewer instructions (optional)…"
                        rows={2}
                        style={{
                            width: "100%",
                            resize: "vertical",
                            background: "oklch(0.06 0.005 0 / 0.8)",
                            border: "1px solid oklch(1 0 0 / 0.08)",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 10,
                            color: "var(--text-primary)",
                            outline: "none",
                            fontFamily: "inherit",
                            marginBottom: 8,
                            boxSizing: "border-box",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = NODE_ACCENTS.human_approval; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "oklch(1 0 0 / 0.08)"; }}
                    />

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 6 }}>
                        {/* Approve */}
                        <button
                            onClick={handleApprove}
                            disabled={!!actionLoading}
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: "none",
                                background: "oklch(0.55 0.18 145)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: actionLoading ? "wait" : "pointer",
                                opacity: actionLoading && actionLoading !== "approve" ? 0.4 : 1,
                                transition: "opacity 150ms",
                            }}
                        >
                            <Check size={11} />
                            {actionLoading === "approve" ? "…" : "Approve"}
                        </button>

                        {/* Retry */}
                        <button
                            onClick={handleRetry}
                            disabled={!!actionLoading}
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: "none",
                                background: "oklch(0.60 0.15 70)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: actionLoading ? "wait" : "pointer",
                                opacity: actionLoading && actionLoading !== "retry" ? 0.4 : 1,
                                transition: "opacity 150ms",
                            }}
                        >
                            <RefreshCw size={11} />
                            {actionLoading === "retry" ? "…" : "Retry"}
                        </button>

                        {/* Decline */}
                        <button
                            onClick={handleDecline}
                            disabled={!!actionLoading}
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: "none",
                                background: "oklch(0.50 0.18 25)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: actionLoading ? "wait" : "pointer",
                                opacity: actionLoading ? 0.4 : 1,
                                transition: "opacity 150ms",
                            }}
                        >
                            <X size={11} />
                            Decline
                        </button>
                    </div>
                </div>
            )}
        </BaseNodeV2>
    );
}
