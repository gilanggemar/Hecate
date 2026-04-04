"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { X, Trash2, RefreshCw } from "lucide-react";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";
import { useAvailableAgents } from "@/hooks/useAvailableAgents";
import { NODE_ACCENTS } from "./nodes/nodeStyles";
import type { Node as RFNode } from "@xyflow/react";

/**
 * Self-managing config panel — reads selectedNodeId + configPanelOpen
 * from the builder store and renders inline. Now positioned inside the
 * canvas container (absolute) with z-index depth on the middle pane.
 */
export default function NodeConfigPanel() {
    const { id: workflowId } = useParams() as { id: string };
    const [isRefreshing, setIsRefreshing] = useState(false);
    const selectedNodeId = useWorkflowBuilderStore((s) => s.selectedNodeId);
    const configPanelOpen = useWorkflowBuilderStore((s) => s.configPanelOpen);
    const nodes = useWorkflowBuilderStore((s) => s.nodes);
    const edges = useWorkflowBuilderStore((s) => s.edges);
    const removeNode = useWorkflowBuilderStore((s) => s.removeNode);
    const updateNodeData = useWorkflowBuilderStore((s) => s.updateNodeData);
    const setSelectedNode = useWorkflowBuilderStore((s) => s.setSelectedNode);
    const setConfigPanelOpen = useWorkflowBuilderStore((s) => s.setConfigPanelOpen);
    const availableAgents = useAvailableAgents();

    if (!configPanelOpen || !selectedNodeId) return null;

    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return null;

    // Incoming connections for Left Pane
    const incomingEdges = edges.filter((e) => e.target === selectedNodeId);
    const incomingNodes = incomingEdges.map((e) => nodes.find(n => n.id === e.source)).filter((n): n is NonNullable<typeof n> => Boolean(n));

    const type = node.type || "unknown";
    const data = node.data as Record<string, any>;
    const accent = NODE_ACCENTS[type as keyof typeof NODE_ACCENTS] || "var(--accent-base)";

    const handleClose = () => {
        setConfigPanelOpen(false);
    };

    const handleDelete = () => {
        removeNode(selectedNodeId);
    };

    const update = (key: string, value: any) => {
        updateNodeData(selectedNodeId, { [key]: value });
    };

    const handleRefresh = async () => {
        if (!data.isFrozen || isRefreshing) return;
        setIsRefreshing(true);
        try {
            // Build priorOutputs from incoming nodes
            const priorOutputs: Record<string, any> = {};
            for (const inc of incomingNodes) {
                if (inc) {
                    const incData = inc.data as any;
                    priorOutputs[inc.id] = incData.frozenResult || incData.lastRunResult;
                }
            }

            const res = await fetch(`/api/workflows/${workflowId}/node/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node,
                    priorOutputs
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData?.error || "Failed to execute node");
            }

            const { result } = await res.json();
            
            // Update node data with new result
            updateNodeData(selectedNodeId, {
                frozenResult: result,
                lastRunResult: result
            });
        } catch (err: any) {
            console.error("Refresh failed:", err);
            alert(`Failed to refresh preview: ${err.message}`);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center",
            background: "oklch(0 0 0 / 0.45)", backdropFilter: "blur(6px)", padding: 24,
        }} onClick={handleClose}>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%", maxWidth: 1100, height: "100%", maxHeight: 650,
                    background: "oklch(0.10 0.005 0 / 0.98)",
                    backdropFilter: "blur(20px)",
                    borderRadius: 6,
                    border: "1px solid oklch(1 0 0 / 0.08)",
                    boxShadow: "0 16px 60px oklch(0 0 0 / 0.6), 0 0 0 1px oklch(1 0 0 / 0.03)",
                    display: "flex", flexDirection: "column", overflow: "hidden",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "14px 20px",
                        borderBottom: "1px solid oklch(1 0 0 / 0.06)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                    }}
                >
                    <div
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: accent,
                            boxShadow: `0 0 8px ${accent}`,
                            flexShrink: 0,
                        }}
                    />
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                        {type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </div>
                    <button
                        onClick={handleDelete}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--status-error)",
                            cursor: "pointer",
                            padding: 4,
                        }}
                        title="Delete node"
                    >
                        <Trash2 size={14} />
                    </button>
                    <button
                        onClick={handleClose}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* 3-Pane Body with Depth */}
                <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
                    
                    {/* LEFT PANE: Previous Node Outputs */}
                    <div style={{
                        flex: 1, display: "flex", flexDirection: "column",
                        background: "oklch(0.07 0.005 0 / 0.6)",
                        position: "relative",
                        zIndex: 1,
                    }}>
                        <div style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid oklch(1 0 0 / 0.04)" }}>
                            Input (Previous Nodes)
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: 16, color: "var(--text-primary)", fontSize: 13, lineHeight: 1.5 }}>
                            {incomingNodes.length === 0 ? (
                                <div style={{ color: "var(--text-muted)", fontSize: 12, fontStyle: "italic", textAlign: "center", marginTop: 40 }}>
                                    No incoming connections
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    {incomingNodes.map((inc) => {
                                        const incData = inc?.data as any;
                                        const output = incData?.frozenResult || incData?.lastRunResult;
                                        return (
                                            <div key={inc?.id}>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                                                    {incData?.label || inc?.id}
                                                </div>
                                                <div style={{
                                                    background: "oklch(1 0 0 / 0.03)", padding: 12, borderRadius: 8,
                                                    border: "1px solid oklch(1 0 0 / 0.06)", whiteSpace: "pre-wrap", overflowX: "auto"
                                                }}>
                                                    {output ? (typeof output === 'object' ? JSON.stringify(output, null, 2) : output) : "No output available yet."}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MIDDLE PANE: Config Form — elevated with drop shadow */}
                    <div style={{
                        width: 360, flexShrink: 0, overflowY: "auto", padding: 16,
                        display: "flex", flexDirection: "column", gap: 14,
                        position: "relative",
                        zIndex: 3,
                        background: "oklch(0.11 0.005 0 / 1)",
                        boxShadow: "-10px 0 30px oklch(0 0 0 / 0.35), 10px 0 30px oklch(0 0 0 / 0.35), 0 0 0 1px oklch(1 0 0 / 0.05)",
                    }}>
                        <FormField label="Label">
                            <input
                                type="text"
                                value={data.label || ""}
                                onChange={(e) => update("label", e.target.value)}
                                style={inputStyle}
                            />
                        </FormField>

                        {!type.includes('trigger') && type !== 'group' && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "oklch(0.08 0.005 0 / 0.6)", borderRadius: 8, border: "1px solid oklch(1 0 0 / 0.08)" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>Freeze Node Output</span>
                                    <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>Skip execution and use last output</span>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={!!data.isFrozen}
                                    onChange={(e) => update("isFrozen", e.target.checked)}
                                    style={{ cursor: "pointer", accentColor: "var(--accent-base)" }}
                                />
                            </div>
                        )}

                        {(type === "agent_step" || type === "agent") && <AgentStepConfig data={data} update={update} agents={availableAgents} />}
                        {type === "formatter_step" && <FormatterConfig data={data} update={update} incomingNodes={incomingNodes} />}
                        {type === "condition" && <ConditionConfigForm data={data} update={update} incomingNodes={incomingNodes} />}
                        {type === "human_approval" && <HumanApprovalConfigForm data={data} update={update} nodes={nodes} />}
                        {type === "output" && <OutputConfigForm data={data} update={update} nodes={nodes} />}
                        {type === "schedule_trigger" && <ScheduleConfig data={data} update={update} />}
                        {type === "webhook_trigger" && <WebhookConfig data={data} update={update} />}
                        {type === "delay" && <DelayConfigForm data={data} update={update} />}
                        {type === "variable_set" && <VariableSetConfigForm data={data} update={update} incomingNodes={incomingNodes} />}
                        {type === "http_request" && <HttpRequestConfigForm data={data} update={update} incomingNodes={incomingNodes} />}
                        {type === "loop" && <LoopConfigForm data={data} update={update} nodes={nodes} />}
                        {type === "note" && <NoteConfigForm data={data} update={update} />}
                        {type === "checkpoint" && <CheckpointConfigForm data={data} update={update} />}
                        {type === "convergence" && <ConvergenceConfigForm data={data} update={update} />}
                    </div>

                    {/* RIGHT PANE: Current Node Output */}
                    <div style={{
                        flex: 1, display: "flex", flexDirection: "column",
                        background: "oklch(0.07 0.005 0 / 0.6)",
                        position: "relative",
                        zIndex: 1,
                    }}>
                        <div style={{ padding: "12px 16px", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid oklch(1 0 0 / 0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>Output (Current Node)</span>
                            {data.isFrozen && (
                                <button
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: isRefreshing ? "var(--text-muted)" : "var(--accent-base)",
                                        cursor: isRefreshing ? "not-allowed" : "pointer",
                                        padding: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                        transition: "color 0.2s"
                                    }}
                                    title="Refresh Output Preview"
                                >
                                    <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
                                    {isRefreshing ? "Refreshing..." : "Refresh"}
                                </button>
                            )}
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: 16, color: "var(--text-primary)", fontSize: 13, lineHeight: 1.5 }}>
                            <div style={{
                                background: "oklch(1 0 0 / 0.03)", padding: 12, borderRadius: 8,
                                border: "1px solid oklch(1 0 0 / 0.06)", whiteSpace: "pre-wrap", overflowX: "auto", minHeight: 100
                            }}>
                                {data.frozenResult || data.lastRunResult ? 
                                    (typeof (data.frozenResult || data.lastRunResult) === 'object' ? 
                                        JSON.stringify(data.frozenResult || data.lastRunResult, null, 2) 
                                        : (data.frozenResult || data.lastRunResult))
                                    : <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>Execute workflow to generate output...</span>
                                }
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

// ─── Type-specific config forms ──────────────────────────────

function AgentStepConfig({ data, update, agents }: { data: any; update: (k: string, v: any) => void; agents: any[] }) {
    return (
        <>
            <FormField label="Agent">
                <select
                    value={data.agentId || ""}
                    onChange={(e) => {
                        const agent = agents.find((a: any) => a.id === e.target.value);
                        update("agentId", e.target.value);
                        if (agent) {
                            update("agentName", agent.name || e.target.value);
                            update("provider", agent.id === 'agent-zero' ? 'Agent Zero' : 'OpenClaw');
                        }
                    }}
                    style={inputStyle}
                >
                    <option value="">Select an agent…</option>
                    {agents.map((a: any) => (
                        <option key={a.id} value={a.id}>
                            {a.name || a.id}
                        </option>
                    ))}
                </select>
            </FormField>
            <FormField label="Task / Prompt">
                <textarea
                    value={data.task || ""}
                    onChange={(e) => update("task", e.target.value)}
                    placeholder={"Describe what this agent should do...\nUse {{prev.step_id.outputText}} for prior outputs"}
                    style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                />
            </FormField>
            
            <AdvancedSettings>
                <FormField label="Response Mode">
                    <select value={data.responseMode || "text"} onChange={(e) => update("responseMode", e.target.value)} style={inputStyle}>
                        <option value="text">Text</option>
                        <option value="json">JSON</option>
                    </select>
                </FormField>
                <FormField label="Timeout (seconds)">
                    <input
                        type="number"
                        value={data.timeoutSec || 120}
                        onChange={(e) => update("timeoutSec", parseInt(e.target.value) || 120)}
                        style={inputStyle}
                    />
                </FormField>
            </AdvancedSettings>
        </>
    );
}

function FormatterConfig({ data, update, incomingNodes }: { data: any; update: (k: string, v: any) => void; incomingNodes: RFNode[] }) {
    const [selectedVar, setSelectedVar] = useState<string>("");

    const handleInsert = () => {
        if (!selectedVar) return;
        const currentText = data.template || "";
        update("template", currentText + selectedVar);
    };

    return (
        <>
            <FormField label="Action / Format">
                <select 
                    value={data.formatMode || "template"}
                    onChange={(e) => update("formatMode", e.target.value)}
                    style={inputStyle}
                >
                    <option value="template">Replace Variables in Text</option>
                    <option value="uppercase">Convert to UPPERCASE</option>
                    <option value="lowercase">Convert to lowercase</option>
                    <option value="extract_json">Extract & Format JSON Array/Object</option>
                    <option value="remove_whitespace">Remove extra whitespace</option>
                </select>
            </FormField>

            <FormField label="Message / Content">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Insert Data Toolbar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "oklch(0.08 0.005 0 / 0.6)", padding: "6px 8px", borderRadius: 6, border: "1px solid oklch(1 0 0 / 0.08)" }}>
                        <select 
                            value={selectedVar}
                            onChange={(e) => setSelectedVar(e.target.value)}
                            style={{ ...inputStyle, flex: 1, padding: "4px 8px", fontSize: 11, minHeight: 28 }}
                        >
                            <option value="">-- Select Data to Insert --</option>
                            {incomingNodes.map(node => (
                                <option key={node.id} value={`{{prev.${node.id}.outputText}}`}>
                                    Output from: {(node.data as any)?.label || node.id}
                                </option>
                            ))}
                        </select>
                        <button 
                            onClick={handleInsert}
                            disabled={!selectedVar}
                            title="Insert data into message"
                            style={{
                                background: selectedVar ? "var(--accent-base)" : "oklch(1 0 0 / 0.05)",
                                color: selectedVar ? "#000" : "var(--text-muted)",
                                border: "none",
                                borderRadius: 4,
                                padding: "4px 10px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: selectedVar ? "pointer" : "not-allowed",
                                height: 28,
                                transition: "all 0.2s"
                            }}
                        >
                            Insert
                        </button>
                    </div>

                    <textarea
                        value={data.template || ""}
                        onChange={(e) => update("template", e.target.value)}
                        placeholder="Enter your message or content here..."
                        style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                    />
                </div>
            </FormField>
            
            <AdvancedSettings>
                <FormField label="Raw JSON / Template">
                    <textarea
                        value={data.template || ""}
                        onChange={(e) => update("template", e.target.value)}
                        placeholder={"Use {{prev.step_id.outputText}} for prior outputs\nUse {{variables.key}} for variables"}
                        style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: "monospace" }}
                    />
                </FormField>
                <FormField label="Output Key (Optional)">
                    <input
                        type="text"
                        value={data.outputKey || ""}
                        onChange={(e) => update("outputKey", e.target.value)}
                        placeholder="Store result as a variable. e.g. formatted_text"
                        style={inputStyle}
                    />
                </FormField>
            </AdvancedSettings>
        </>
    );
}

function ConditionConfigForm({ data, update, incomingNodes }: { data: any; update: (k: string, v: any) => void, incomingNodes: RFNode[] }) {
    const handleUpdate = (field: string, val: string) => {
        update(field, val);
        const op = field === 'operator' ? val : (data.operator || '==');
        const vCheck = field === 'varCheck' ? val : (data.varCheck || '');
        const vMatch = field === 'varMatch' ? val : (data.varMatch || '');
        
        let expr = "";
        switch (op) {
            case "==": expr = `"${vCheck}" === "${vMatch}"`; break;
            case "!=": expr = `"${vCheck}" !== "${vMatch}"`; break;
            case "contains": expr = `String("${vCheck}").includes("${vMatch}")`; break;
            case "not_contains": expr = `!String("${vCheck}").includes("${vMatch}")`; break;
            case "starts_with": expr = `String("${vCheck}").startsWith("${vMatch}")`; break;
            case "ends_with": expr = `String("${vCheck}").endsWith("${vMatch}")`; break;
            case "is_empty": expr = `!String("${vCheck}").trim()`; break;
            case "not_empty": expr = `String("${vCheck}").trim().length > 0`; break;
            default: expr = `"${vCheck}" === "${vMatch}"`;
        }
        update("expression", expr);
    };

    return (
        <>
            <FormField label="Data to Check">
                <select 
                    value={data.varCheck || ""} 
                    onChange={e => handleUpdate('varCheck', e.target.value)} 
                    style={inputStyle}
                >
                    <option value="">-- Select Data Source --</option>
                    {incomingNodes.map(node => (
                        <option key={node.id} value={`{{prev.${node.id}.outputText}}`}>
                            Output from: {(node.data as any)?.label || node.id}
                        </option>
                    ))}
                    <option value="custom">Custom Variable...</option>
                </select>
            </FormField>
            
            {(data.varCheck === "custom" || (!incomingNodes.find(n => `{{prev.${n.id}.outputText}}` === data.varCheck) && data.varCheck)) && (
                <FormField label="Custom Variable">
                    <input 
                        type="text" 
                        value={data.varCheck === "custom" ? "" : (data.varCheck || "")} 
                        onChange={e => handleUpdate('varCheck', e.target.value)} 
                        placeholder="{{prev.step_id.outputText}}" 
                        style={inputStyle} 
                    />
                </FormField>
            )}

            <FormField label="Condition">
                <select value={data.operator || '=='} onChange={e => handleUpdate('operator', e.target.value)} style={inputStyle}>
                    <option value="==">Is exactly</option>
                    <option value="!=">Is not</option>
                    <option value="contains">Contains text</option>
                    <option value="not_contains">Does not contain text</option>
                    <option value="starts_with">Starts with</option>
                    <option value="ends_with">Ends with</option>
                    <option value="is_empty">Is empty</option>
                    <option value="not_empty">Is not empty</option>
                </select>
            </FormField>

            {!['is_empty', 'not_empty'].includes(data.operator) && (
                <FormField label="Value to match against">
                    <input 
                        type="text" 
                        value={data.varMatch || ""} 
                        onChange={e => handleUpdate('varMatch', e.target.value)} 
                        placeholder="e.g. success, true, etc." 
                        style={inputStyle} 
                    />
                </FormField>
            )}

            <AdvancedSettings>
                <FormField label="Raw Code Expression">
                    <textarea
                        value={data.expression || ""}
                        onChange={(e) => update("expression", e.target.value)}
                        placeholder={'e.g. "{{prev.step_1.outputText}}" == "approved"'}
                        style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "monospace" }}
                    />
                </FormField>
            </AdvancedSettings>
        </>
    );
}

function HumanApprovalConfigForm({ data, update, nodes }: { data: any; update: (k: string, v: any) => void; nodes: RFNode[] }) {
    const checkpoints = nodes.filter(n => n.type === 'checkpoint');
    return (
        <>
            <FormField label="Instructions">
                <textarea
                    value={data.instructions || ""}
                    onChange={(e) => update("instructions", e.target.value)}
                    placeholder="What should the reviewer check?"
                    style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                />
            </FormField>
            {checkpoints.length > 0 && (
                <FormField label="Cycle Checkpoint">
                    <select
                        value={data.checkpointId || ""}
                        onChange={(e) => update("checkpointId", e.target.value)}
                        style={inputStyle}
                    >
                        <option value="">(None)</option>
                        {checkpoints.map(cp => (
                            <option key={cp.id} value={cp.id}>{(cp.data as any).label || 'Checkpoint'}</option>
                        ))}
                    </select>
                </FormField>
            )}
        </>
    );
}

function OutputConfigForm({ data, update, nodes }: { data: any; update: (k: string, v: any) => void; nodes: RFNode[] }) {
    const checkpoints = nodes.filter(n => n.type === 'checkpoint');
    const hasCheckpoint = !!data.checkpointId;
    return (
        <>
            <FormField label="Output Mode">
                <select 
                    value={data.outputMode || "return"} 
                    onChange={(e) => update("outputMode", e.target.value)} 
                    style={hasCheckpoint ? { ...inputStyle, opacity: 0.5, cursor: "not-allowed" } : inputStyle}
                    disabled={hasCheckpoint}
                >
                    <option value="return">Return result</option>
                    <option value="notification">Send to notification</option>
                    <option value="webhook">Send to webhook</option>
                    <option value="log">Log only</option>
                </select>
            </FormField>
            {data.outputMode === "webhook" && (
                <FormField label="Webhook URL">
                    <input
                        type="url"
                        value={data.webhookUrl || ""}
                        onChange={(e) => update("webhookUrl", e.target.value)}
                        placeholder="https://..."
                        style={hasCheckpoint ? { ...inputStyle, opacity: 0.5, cursor: "not-allowed" } : inputStyle}
                        disabled={hasCheckpoint}
                    />
                </FormField>
            )}

            {checkpoints.length > 0 ? (
                <FormField label="Cycle Checkpoint">
                    <select
                        value={data.checkpointId || ""}
                        onChange={(e) => update("checkpointId", e.target.value)}
                        style={inputStyle}
                    >
                        <option value="">(None)</option>
                        {checkpoints.map(cp => (
                            <option key={cp.id} value={cp.id}>{(cp.data as any).label || 'Checkpoint'}</option>
                        ))}
                    </select>
                </FormField>
            ) : (
                <FormField label="Cycle Checkpoint">
                    <select disabled style={{ ...inputStyle, opacity: 0.5, cursor: "not-allowed" }}>
                        <option value="">(Select Checkpoint)</option>
                    </select>
                    <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.2 }}>
                        Add a Checkpoint node to the canvas to select it.
                    </div>
                </FormField>
            )}
            
            <AdvancedSettings>
                <FormField label="Output Template">
                    <textarea
                        value={data.template || ""}
                        onChange={(e) => update("template", e.target.value)}
                        placeholder={"Optional: format the final output\nUse {{prev.step_id.outputText}} for prior outputs"}
                        style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "monospace" }}
                    />
                </FormField>
            </AdvancedSettings>
        </>
    );
}

function ScheduleConfig({ data, update }: { data: any; update: (k: string, v: any) => void }) {
    const handleIntervalChange = (val: string) => {
        update("intervalType", val);
        // Reset or set default cron based on type
        if (val === "minutes") update("cron", `*/5 * * * *`);
        else if (val === "hours") update("cron", `0 * * * *`);
        else if (val === "days") update("cron", `0 9 * * *`);
    };

    return (
        <>
            <FormField label="Interval Type">
                <select
                    value={data.intervalType || "cron"}
                    onChange={(e) => handleIntervalChange(e.target.value)}
                    style={inputStyle}
                >
                    <option value="cron">Custom / Advanced Cron</option>
                    <option value="minutes">Every X Minutes</option>
                    <option value="hours">Every X Hours</option>
                    <option value="days">Daily at Time</option>
                </select>
            </FormField>

            {data.intervalType === "minutes" && (
                <FormField label="Minutes">
                    <input
                        type="number"
                        min="1"
                        max="59"
                        value={data.intervalValue || 5}
                        onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value) || 1);
                            update("intervalValue", v);
                            update("cron", `*/${v} * * * *`);
                        }}
                        style={inputStyle}
                    />
                </FormField>
            )}

            {data.intervalType === "hours" && (
                <FormField label="Hours">
                    <input
                        type="number"
                        min="1"
                        max="23"
                        value={data.intervalValue || 1}
                        onChange={(e) => {
                            const v = Math.max(1, parseInt(e.target.value) || 1);
                            update("intervalValue", v);
                            update("cron", `0 */${v} * * *`);
                        }}
                        style={inputStyle}
                    />
                </FormField>
            )}

            <AdvancedSettings>
                <FormField label="Cron Expression">
                    <input
                        type="text"
                        value={data.cron || ""}
                        onChange={(e) => {
                            update("cron", e.target.value);
                            update("intervalType", "cron");
                        }}
                        placeholder="0 9 * * 1-5   (Mon-Fri at 9am)"
                        style={{ ...inputStyle, fontFamily: "monospace" }}
                    />
                </FormField>
            </AdvancedSettings>
        </>
    );
}

function WebhookConfig({ data, update }: { data: any; update: (k: string, v: any) => void }) {
    return (
        <>
            <FormField label="Trigger Details">
                <input
                    type="text"
                    value={data.triggerName || ""}
                    onChange={(e) => update("triggerName", e.target.value)}
                    placeholder="E.g. On File Uploaded"
                    style={inputStyle}
                />
            </FormField>

            <AdvancedSettings>
                <FormField label="Expected Payload (JSON)">
                    <textarea
                        value={typeof data.webhookPayload === "object" ? JSON.stringify(data.webhookPayload, null, 2) : data.webhookPayload || ""}
                        onChange={(e) => {
                            try {
                                update("webhookPayload", JSON.parse(e.target.value));
                            } catch {
                                update("webhookPayload", e.target.value);
                            }
                        }}
                        placeholder='{ "key": "value" }'
                        style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "monospace" }}
                    />
                </FormField>
            </AdvancedSettings>
        </>
    );
}

// ─── Shared form field wrapper ───────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {label}
            </label>
            {children}
        </div>
    );
}

// ─── Shared input style ──────────────────────────────────────

function AdvancedSettings({ children, label = "Advanced / Raw Code" }: { children: React.ReactNode; label?: string }) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div style={{ marginTop: 8, padding: "10px 12px", background: "oklch(1 0 0 / 0.02)", border: "1px dashed oklch(1 0 0 / 0.1)", borderRadius: 8 }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    width: "100%", 
                    background: "transparent", 
                    border: "none", 
                    padding: 0, 
                    color: "var(--text-secondary)", 
                    fontSize: 11, 
                    fontWeight: 600, 
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                }}
            >
                <span style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", marginRight: 6, display: "inline-block" }}>
                    ▶
                </span>
                {label}
            </button>
            
            {isOpen && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                    {children}
                </div>
            )}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 12,
    color: "var(--text-primary)",
    background: "oklch(0.08 0.005 0 / 0.6)",
    border: "1px solid oklch(1 0 0 / 0.08)",
    borderRadius: 8,
    outline: "none",
    transition: "border-color 200ms",
    fontFamily: "inherit",
};

// ─── Preset Selector ─────────────────────────────────────────

type Preset = {
    label: string;
    description: string;
    values: Record<string, any>;
};

function PresetSelector({ presets, onApply }: { presets: Preset[]; onApply: (values: Record<string, any>) => void }) {
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{
                fontSize: 9, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 5,
            }}>
                Quick Presets
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {presets.map((p) => (
                    <button
                        key={p.label}
                        onClick={() => onApply(p.values)}
                        title={p.description}
                        style={{
                            padding: "4px 10px",
                            fontSize: 10,
                            fontWeight: 500,
                            color: "var(--text-secondary)",
                            background: "oklch(1 0 0 / 0.05)",
                            border: "1px solid oklch(1 0 0 / 0.08)",
                            borderRadius: 6,
                            cursor: "pointer",
                            transition: "all 150ms ease",
                            whiteSpace: "nowrap",
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.background = "oklch(1 0 0 / 0.10)";
                            (e.target as HTMLElement).style.borderColor = "oklch(1 0 0 / 0.18)";
                            (e.target as HTMLElement).style.color = "var(--text-primary)";
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.background = "oklch(1 0 0 / 0.05)";
                            (e.target as HTMLElement).style.borderColor = "oklch(1 0 0 / 0.08)";
                            (e.target as HTMLElement).style.color = "var(--text-secondary)";
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Preset Data ─────────────────────────────────────────────

const DELAY_PRESETS: Preset[] = [
    { label: "⚡ Quick (2s)", description: "Short 2-second pause", values: { delaySec: 2 } },
    { label: "⏱ Short (5s)", description: "5-second pause between steps", values: { delaySec: 5 } },
    { label: "⏳ Medium (15s)", description: "15-second break for rate-limiting", values: { delaySec: 15 } },
    { label: "🕐 Half min (30s)", description: "30-second wait", values: { delaySec: 30 } },
    { label: "⏰ 1 minute", description: "Wait 1 full minute", values: { delaySec: 60 } },
    { label: "🕔 5 minutes", description: "Wait 5 minutes for external processing", values: { delaySec: 300 } },
];

const VARIABLE_SET_PRESETS: Preset[] = [
    { label: "📦 Store output", description: "Save the previous step's text output to a variable", values: { variableName: "result", variableValue: "{{prev.step_1.outputText}}", operation: "set" } },
    { label: "🔢 Set counter", description: "Initialize a numeric counter variable", values: { variableName: "counter", variableValue: "0", operation: "set" } },
    { label: "📝 Build summary", description: "Append outputs to build a running summary", values: { variableName: "summary", variableValue: "{{prev.step_1.outputText}}\n", operation: "append" } },
    { label: "🏷 Set status", description: "Store a status flag for conditional branching", values: { variableName: "status", variableValue: "ready", operation: "set" } },
    { label: "📋 Set prompt", description: "Store a prompt template for a following agent step", values: { variableName: "prompt", variableValue: "Summarize the following:\n{{prev.step_1.outputText}}", operation: "set" } },
];

const HTTP_REQUEST_PRESETS: Preset[] = [
    { label: "🔍 GET API", description: "Fetch data from a JSON API endpoint", values: { method: "GET", url: "https://api.example.com/data", body: "", headers: { "Accept": "application/json" }, timeoutSec: 30 } },
    { label: "📤 POST JSON", description: "Send JSON data to an API endpoint", values: { method: "POST", url: "https://api.example.com/submit", body: '{\n  "data": "{{prev.step_1.outputText}}"\n}', headers: { "Content-Type": "application/json" }, timeoutSec: 30 } },
    { label: "💬 Slack message", description: "Post a message to a Slack channel via webhook", values: { method: "POST", url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL", body: '{\n  "text": "{{prev.step_1.outputText}}"\n}', headers: { "Content-Type": "application/json" }, timeoutSec: 15 } },
    { label: "🎮 Discord message", description: "Send a message to a Discord channel via webhook", values: { method: "POST", url: "https://discord.com/api/webhooks/YOUR/WEBHOOK", body: '{\n  "content": "{{prev.step_1.outputText}}"\n}', headers: { "Content-Type": "application/json" }, timeoutSec: 15 } },
    { label: "📧 Email (webhook)", description: "Trigger an email via a webhook service", values: { method: "POST", url: "https://api.emailservice.com/send", body: '{\n  "to": "user@example.com",\n  "subject": "Workflow Output",\n  "body": "{{prev.step_1.outputText}}"\n}', headers: { "Content-Type": "application/json", "Authorization": "Bearer YOUR_API_KEY" }, timeoutSec: 30 } },
    { label: "🔗 Custom webhook", description: "Send workflow data to a custom webhook endpoint", values: { method: "POST", url: "https://your-server.com/webhook", body: '{\n  "event": "workflow_completed",\n  "output": "{{prev.step_1.outputText}}"\n}', headers: { "Content-Type": "application/json" }, timeoutSec: 30 } },
];

const LOOP_PRESETS: Preset[] = [
    { label: "🔁 Retry 3x", description: "Retry a step up to 3 times", values: { loopType: "count", maxIterations: 3 } },
    { label: "🔄 Repeat 5x", description: "Repeat a sequence 5 times", values: { loopType: "count", maxIterations: 5 } },
    { label: "🔟 Batch (10x)", description: "Process in batches of 10", values: { loopType: "count", maxIterations: 10 } },
    { label: "📋 For each item", description: "Iterate over each item from a previous step's output", values: { loopType: "for_each", maxIterations: 20, iterateOver: "{{prev.step_1.outputText}}" } },
];

const NOTE_PRESETS: Preset[] = [
    { label: "📌 TODO", description: "Mark something that needs to be done", values: { noteText: "TODO: " } },
    { label: "⚠️ Warning", description: "Add a caution/warning note", values: { noteText: "⚠️ WARNING: This step requires careful configuration. Make sure to..." } },
    { label: "📖 Documentation", description: "Document what this section does", values: { noteText: "📖 This section of the workflow handles...\n\nInput: \nOutput: \nNotes: " } },
    { label: "💡 Tip", description: "Add a helpful tip for collaborators", values: { noteText: "💡 TIP: " } },
];

// ─── New Node Config Forms ───────────────────────────────────

function DelayConfigForm({ data, update }: { data: any; update: (k: string, v: any) => void }) {
    const applyPreset = (values: Record<string, any>) => {
        for (const [k, v] of Object.entries(values)) update(k, v);
    };
    return (
        <>
            <PresetSelector presets={DELAY_PRESETS} onApply={applyPreset} />
            <FormField label="Delay (seconds)">
                <input
                    type="number"
                    min="1"
                    max="3600"
                    value={data.delaySec || 5}
                    onChange={(e) => update("delaySec", Math.max(1, parseInt(e.target.value) || 1))}
                    style={inputStyle}
                />
            </FormField>
            <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 0" }}>
                ≈ {(data.delaySec || 5) >= 60 ? `${Math.round((data.delaySec || 5) / 60)} minute(s)` : `${data.delaySec || 5} second(s)`}
            </div>
        </>
    );
}

function VariableSetConfigForm({ data, update, incomingNodes }: { data: any; update: (k: string, v: any) => void; incomingNodes: RFNode[] }) {
    const applyPreset = (values: Record<string, any>) => {
        for (const [k, v] of Object.entries(values)) update(k, v);
    };
    return (
        <>
            <PresetSelector presets={VARIABLE_SET_PRESETS} onApply={applyPreset} />
            <FormField label="Variable Name">
                <input
                    type="text"
                    value={data.variableName || ""}
                    onChange={(e) => update("variableName", e.target.value)}
                    placeholder="e.g. result, summary, counter"
                    style={{ ...inputStyle, fontFamily: "monospace" }}
                />
            </FormField>
            <FormField label="Value">
                <textarea
                    value={data.variableValue || ""}
                    onChange={(e) => update("variableValue", e.target.value)}
                    placeholder={"Static text or {{prev.step_id.outputText}}"}
                    style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                />
            </FormField>
            <FormField label="Operation">
                <select value={data.operation || "set"} onChange={(e) => update("operation", e.target.value)} style={inputStyle}>
                    <option value="set">Set (replace)</option>
                    <option value="append">Append</option>
                    <option value="prepend">Prepend</option>
                </select>
            </FormField>
        </>
    );
}

function HttpRequestConfigForm({ data, update, incomingNodes }: { data: any; update: (k: string, v: any) => void; incomingNodes: RFNode[] }) {
    const applyPreset = (values: Record<string, any>) => {
        for (const [k, v] of Object.entries(values)) update(k, v);
    };
    return (
        <>
            <PresetSelector presets={HTTP_REQUEST_PRESETS} onApply={applyPreset} />
            <FormField label="HTTP Method">
                <select value={data.method || "GET"} onChange={(e) => update("method", e.target.value)} style={inputStyle}>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </FormField>
            <FormField label="URL">
                <input
                    type="text"
                    value={data.url || ""}
                    onChange={(e) => update("url", e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                    style={{ ...inputStyle, fontFamily: "monospace" }}
                />
            </FormField>
            {data.method !== "GET" && (
                <FormField label="Request Body">
                    <textarea
                        value={data.body || ""}
                        onChange={(e) => update("body", e.target.value)}
                        placeholder={'{ "key": "{{prev.step_id.outputText}}" }'}
                        style={{ ...inputStyle, minHeight: 80, resize: "vertical", fontFamily: "monospace" }}
                    />
                </FormField>
            )}
            <AdvancedSettings>
                <FormField label="Headers (JSON)">
                    <textarea
                        value={typeof data.headers === "object" ? JSON.stringify(data.headers, null, 2) : data.headers || ""}
                        onChange={(e) => {
                            try { update("headers", JSON.parse(e.target.value)); } catch { update("headers", e.target.value); }
                        }}
                        placeholder={'{ "Authorization": "Bearer ..." }'}
                        style={{ ...inputStyle, minHeight: 60, resize: "vertical", fontFamily: "monospace" }}
                    />
                </FormField>
                <FormField label="Timeout (seconds)">
                    <input
                        type="number"
                        value={data.timeoutSec || 30}
                        onChange={(e) => update("timeoutSec", parseInt(e.target.value) || 30)}
                        style={inputStyle}
                    />
                </FormField>
            </AdvancedSettings>
        </>
    );
}

function LoopConfigForm({ data, update, nodes }: { data: any; update: (k: string, v: any) => void; nodes: RFNode[] }) {
    const applyPreset = (values: Record<string, any>) => {
        for (const [k, v] of Object.entries(values)) update(k, v);
    };
    const checkpoints = nodes.filter(n => n.type === 'checkpoint');
    return (
        <>
            <PresetSelector presets={LOOP_PRESETS} onApply={applyPreset} />
            <FormField label="Loop Type">
                <select value={data.loopType || "count"} onChange={(e) => update("loopType", e.target.value)} style={inputStyle}>
                    <option value="count">Repeat N times</option>
                    <option value="for_each">For each item</option>
                </select>
            </FormField>
            <FormField label={data.loopType === "for_each" ? "Max Iterations" : "Repeat Count"}>
                <input
                    type="number"
                    min="1"
                    max="100"
                    value={data.maxIterations || 3}
                    onChange={(e) => update("maxIterations", Math.max(1, parseInt(e.target.value) || 1))}
                    style={inputStyle}
                />
            </FormField>
            {data.loopType === "for_each" && (
                <FormField label="Iterate Over">
                    <input
                        type="text"
                        value={data.iterateOver || ""}
                        onChange={(e) => update("iterateOver", e.target.value)}
                        placeholder="{{prev.step_id.outputText}}"
                        style={{ ...inputStyle, fontFamily: "monospace" }}
                    />
                </FormField>
            )}
            {checkpoints.length > 0 && (
                <FormField label="Cycle Checkpoint">
                    <select
                        value={data.checkpointId || ""}
                        onChange={(e) => update("checkpointId", e.target.value)}
                        style={inputStyle}
                    >
                        <option value="">(None)</option>
                        {checkpoints.map(cp => (
                            <option key={cp.id} value={cp.id}>{(cp.data as any).label || 'Checkpoint'}</option>
                        ))}
                    </select>
                </FormField>
            )}
        </>
    );
}

function NoteConfigForm({ data, update }: { data: any; update: (k: string, v: any) => void }) {
    const applyPreset = (values: Record<string, any>) => {
        for (const [k, v] of Object.entries(values)) update(k, v);
    };
    return (
        <>
            <PresetSelector presets={NOTE_PRESETS} onApply={applyPreset} />
            <FormField label="Note">
                <textarea
                    value={data.noteText || ""}
                    onChange={(e) => update("noteText", e.target.value)}
                    placeholder="Add annotations, documentation, or comments..."
                    style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                />
            </FormField>
        </>
    );
}

function CheckpointConfigForm({ data, update }: { data: any; update: (k: string, v: any) => void }) {
    return (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, padding: "8px 0" }}>
            Checkpoints act as destinations for cycle arcs from a Loop or Human Approval node. Give this checkpoint a descriptive node name so you can easily select it from other nodes.
        </div>
    );
}

function ConvergenceConfigForm({ data, update }: { data: any; update: (k: string, v: any) => void }) {
    return (
        <>
            <FormField label="Merge Strategy">
                <select value={data.mergeStrategy || "wait_all"} onChange={(e) => update("mergeStrategy", e.target.value)} style={inputStyle}>
                    <option value="wait_all">Wait for all incoming paths</option>
                    <option value="first_arrives">Trigger on first arrived path</option>
                </select>
            </FormField>
        </>
    );
}
