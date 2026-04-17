"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Puzzle, Loader2, CheckCircle2, AlertCircle, Copy, Check, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSocketStore, useSocket } from "@/lib/useSocket";
import { toast } from "sonner";

type InstallStatus = "idle" | "sending" | "waiting" | "success" | "failed";

export function PluginInstall() {
    const { agents, chatMessages } = useSocketStore();
    const { sendChatMessage } = useSocket();
    const [status, setStatus] = useState<InstallStatus>("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [copied, setCopied] = useState(false);
    const watchingRef = useRef(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-pick the first available agent
    const availableAgents = agents.filter(
        (a: any) => a.running || a.probeOk || a.connected
    );
    const effectiveAgent = availableAgents.length > 0
        ? (availableAgents[0].accountId || availableAgents[0].name || availableAgents[0].id)
        : "";

    // ── Watch agent messages for install result markers ──
    useEffect(() => {
        if (!watchingRef.current) return;

        for (const msg of chatMessages) {
            if (msg.role !== "assistant") continue;
            const content = msg.content || "";

            if (content.includes("[OFIERE_INSTALL_RESULT:SUCCESS]")) {
                setStatus("success");
                watchingRef.current = false;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                toast.success("Plugin installed! Restart your OpenClaw gateway to activate.");
                return;
            }

            if (content.includes("[OFIERE_INSTALL_RESULT:FAILED]")) {
                const failMatch = content.match(/❌\s*([^\[]+)/);
                setStatus("failed");
                setErrorMsg(failMatch?.[1]?.trim() || "Installation failed. Check your agent's chat for details.");
                watchingRef.current = false;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                toast.error("Plugin installation failed.");
                return;
            }
        }
    }, [chatMessages]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleInstall = useCallback(async () => {
        if (!effectiveAgent) {
            toast.error("No agent available. Connect an agent first.");
            return;
        }

        setStatus("sending");
        setErrorMsg("");

        try {
            const res = await fetch("/api/plugin/handshake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId: effectiveAgent }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to generate install instructions");
            }

            if (!data.prompt) {
                throw new Error("Server returned empty install prompt");
            }

            // Send the prompt to the agent via browser WebSocket
            const sessionKey = `agent:${effectiveAgent}:nchat`;
            sendChatMessage(effectiveAgent, data.prompt, sessionKey, undefined, true);

            // Start watching for the agent's response
            setStatus("waiting");
            watchingRef.current = true;

            // Timeout after 2 minutes
            timeoutRef.current = setTimeout(() => {
                if (watchingRef.current) {
                    watchingRef.current = false;
                    setStatus("failed");
                    setErrorMsg("Timed out waiting for agent response. Check the agent's chat for details.");
                }
            }, 120_000);

        } catch (err: any) {
            setStatus("failed");
            setErrorMsg(err.message || "Unknown error");
            toast.error(`Install failed: ${err.message}`);
        }
    }, [effectiveAgent, sendChatMessage]);

    const handleCopyCommand = useCallback(async () => {
        const cmd = `openclaw plugins install ofiere-openclaw-plugin`;
        await navigator.clipboard.writeText(cmd);
        setCopied(true);
        toast.success("Install command copied!");
        setTimeout(() => setCopied(false), 2000);
    }, []);

    const handleReset = useCallback(() => {
        setStatus("idle");
        setErrorMsg("");
        watchingRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    return (
        <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
            <CardContent className="p-4 space-y-3">
                {/* Main Row */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center bg-orange-500/10 text-orange-400 shrink-0 mt-0.5">
                            <Puzzle className="w-4.5 h-4.5" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">
                                    Ofiere Plugin for OpenClaw
                                </p>
                                <StatusBadge status={status} />
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
                                Gives all your agents the ability to create, update, and manage tasks directly from chat.
                                Install once — every agent gets the tools automatically.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {(status === "success" || status === "failed") && (
                            <Button
                                onClick={handleReset}
                                variant="ghost"
                                size="sm"
                                className="rounded-full h-8 w-8 p-0"
                            >
                                <RotateCcw className="w-3 h-3 text-muted-foreground" />
                            </Button>
                        )}
                        <Button
                            onClick={handleInstall}
                            disabled={status === "sending" || status === "waiting" || !effectiveAgent}
                            size="sm"
                            className="rounded-full h-8 px-4 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                        >
                            {status === "sending" ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Sending...
                                </>
                            ) : status === "waiting" ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Agent working...
                                </>
                            ) : status === "success" ? (
                                <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    Installed
                                </>
                            ) : (
                                <>
                                    <Puzzle className="w-3 h-3" />
                                    {status === "failed" ? "Retry Install" : "Connect Plugin"}
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Status messages */}
                <AnimatePresence mode="wait">
                    {status === "waiting" && (
                        <motion.div
                            key="waiting"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-[11px] text-blue-400 bg-blue-500/5 border border-blue-500/20 rounded-md px-3 py-2 space-y-1"
                        >
                            <p className="font-medium flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Agent is installing the plugin...
                            </p>
                            <p className="text-blue-400/70">
                                Running <code className="text-[10px] bg-blue-500/10 px-1 rounded">openclaw plugins install ofiere-openclaw-plugin</code> — this may take 30-60 seconds.
                            </p>
                        </motion.div>
                    )}

                    {status === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-[11px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-md px-3 py-2 space-y-1.5"
                        >
                            <p className="font-medium">✅ Ofiere PM plugin installed successfully!</p>
                            <p className="text-emerald-400/70">
                                5 tools registered: LIST_TASKS, CREATE_TASK, UPDATE_TASK, DELETE_TASK, LIST_AGENTS
                            </p>
                            <div className="flex items-center gap-1.5 text-amber-400/90 bg-amber-500/5 border border-amber-500/20 rounded px-2 py-1.5 mt-1">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <p>
                                    <span className="font-medium">Restart required.</span>{" "}
                                    Restart your OpenClaw gateway to activate the plugin.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {status === "failed" && errorMsg && (
                        <motion.div
                            key="error"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2"
                        >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {errorMsg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Fallback: manual install */}
                {availableAgents.length === 0 && (
                    <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground/70">
                            No agents online. Connect an agent first, or install manually:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="text-[10px] text-muted-foreground bg-muted/30 border border-border/40 rounded-md px-2.5 py-1.5 flex-1 overflow-x-auto whitespace-nowrap font-mono">
                                openclaw plugins install ofiere-openclaw-plugin
                            </code>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopyCommand}
                                className="h-7 px-2 text-[10px] rounded-md shrink-0 gap-1"
                            >
                                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                {copied ? "Copied" : "Copy"}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatusBadge({ status }: { status: InstallStatus }) {
    if (status === "idle") return null;

    const config: Record<string, { color: string; label: string }> = {
        sending: { color: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "Sending..." },
        waiting: { color: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "Installing..." },
        success: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Installed" },
        failed: { color: "text-red-400 bg-red-500/10 border-red-500/20", label: "Failed" },
    };

    const cfg = config[status];
    if (!cfg) return null;

    return (
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${cfg.color}`}>
            {cfg.label}
        </span>
    );
}
