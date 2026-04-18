"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Puzzle, Loader2, Copy, Check, ChevronUp, Terminal,
    CheckCircle2, Package, Zap, Container, Server, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type InstallMode = "docker" | "native";
type ActionType = "install" | "uninstall";

export function PluginInstall() {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState<ActionType>("install");
    const [dockerInstall, setDockerInstall] = useState("");
    const [nativeInstall, setNativeInstall] = useState("");
    const [dockerUninstall, setDockerUninstall] = useState("");
    const [nativeUninstall, setNativeUninstall] = useState("");
    const [mode, setMode] = useState<InstallMode>("docker");
    const [copied, setCopied] = useState(false);

    const activeCommand =
        action === "install"
            ? (mode === "docker" ? dockerInstall : nativeInstall)
            : (mode === "docker" ? dockerUninstall : nativeUninstall);

    const fetchCommands = useCallback(async (targetAction: ActionType) => {
        setLoading(true);
        try {
            const res = await fetch("/api/plugin/handshake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load command");

            setDockerInstall(data.dockerCommand || "");
            setNativeInstall(data.nativeCommand || "");
            setDockerUninstall(data.dockerUninstall || "");
            setNativeUninstall(data.nativeUninstall || "");
            setAction(targetAction);
            setExpanded(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to load command");
        } finally {
            setLoading(false);
        }
    }, []);

    const handleActionClick = useCallback(async (targetAction: ActionType) => {
        if (expanded && action === targetAction) {
            setExpanded(false);
            return;
        }
        if (dockerInstall && dockerUninstall) {
            setAction(targetAction);
            setExpanded(true);
        } else {
            await fetchCommands(targetAction);
        }
    }, [expanded, action, dockerInstall, dockerUninstall, fetchCommands]);

    const copyCommand = useCallback(async () => {
        await navigator.clipboard.writeText(activeCommand);
        setCopied(true);
        toast.success("Command copied to clipboard!");
        setTimeout(() => setCopied(false), 2500);
    }, [activeCommand]);

    const isUninstall = action === "uninstall";

    return (
        <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0 overflow-hidden max-w-full">
            <CardContent className="p-4 space-y-3 overflow-hidden max-w-full">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center bg-orange-500/10 text-orange-400 shrink-0 mt-0.5">
                            <Puzzle className="w-4.5 h-4.5" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                                Ofiere Plugin for OpenClaw
                            </p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
                                Gives all your agents the ability to create, update, and manage tasks directly from chat.
                                One command installs everything — no manual setup needed.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            onClick={() => handleActionClick("install")}
                            disabled={loading}
                            size="sm"
                            className="rounded-full h-8 px-4 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                        >
                            {loading && action === "install" ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Loading...
                                </>
                            ) : expanded && action === "install" ? (
                                <>
                                    <ChevronUp className="w-3 h-3" />
                                    Hide
                                </>
                            ) : (
                                <>
                                    <Terminal className="w-3 h-3" />
                                    Install Plugin
                                </>
                            )}
                        </Button>

                        <Button
                            onClick={() => handleActionClick("uninstall")}
                            disabled={loading}
                            size="sm"
                            variant="ghost"
                            className="rounded-full h-8 px-3 text-xs text-red-400/80 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
                        >
                            {loading && action === "uninstall" ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : expanded && action === "uninstall" ? (
                                <ChevronUp className="w-3 h-3" />
                            ) : (
                                <Trash2 className="w-3 h-3" />
                            )}
                            Uninstall
                        </Button>
                    </div>
                </div>

                {/* Command area */}
                <AnimatePresence>
                    {expanded && activeCommand && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 overflow-hidden"
                        >
                            {/* What it does */}
                            {!isUninstall && (
                                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70">
                                    <span className="flex items-center gap-1">
                                        <Package className="w-3 h-3 text-orange-400/60" />
                                        Downloads from npm
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Zap className="w-3 h-3 text-orange-400/60" />
                                        Installs dependencies
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-orange-400/60" />
                                        Auto-configures & restarts
                                    </span>
                                </div>
                            )}

                            {isUninstall && (
                                <div className="text-[10px] text-red-400/70 bg-red-500/5 border border-red-500/15 rounded-md px-3 py-2">
                                    ⚠️ This will completely remove the Ofiere plugin, its environment variables, and its config entries from your OpenClaw installation. 
                                    All agents will lose access to task management tools.
                                </div>
                            )}

                            {/* Mode toggle */}
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setMode("docker")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all ${
                                        mode === "docker"
                                            ? isUninstall
                                                ? "bg-red-500/15 text-red-400 border border-red-500/30"
                                                : "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                                            : "bg-transparent text-muted-foreground/60 border border-transparent hover:text-muted-foreground"
                                    }`}
                                >
                                    <Container className="w-3 h-3" />
                                    Docker
                                    <span className="text-[9px] opacity-60">(most common)</span>
                                </button>
                                <button
                                    onClick={() => setMode("native")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all ${
                                        mode === "native"
                                            ? isUninstall
                                                ? "bg-red-500/15 text-red-400 border border-red-500/30"
                                                : "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                                            : "bg-transparent text-muted-foreground/60 border border-transparent hover:text-muted-foreground"
                                    }`}
                                >
                                    <Server className="w-3 h-3" />
                                    Native
                                </button>
                            </div>

                            {/* Command block */}
                            <div className="group overflow-hidden">
                                <p className="text-[10px] text-muted-foreground/70 mb-1.5 font-medium">
                                    {mode === "docker"
                                        ? "SSH into your VPS host and paste:"
                                        : "SSH into your OpenClaw server and paste:"}
                                </p>
                                <div className={`flex items-stretch border rounded-md overflow-hidden ${
                                    isUninstall 
                                        ? "bg-[#0d0d0d] border-red-900/30"
                                        : "bg-[#0d0d0d] border-border/40"
                                }`}>
                                    <div className="flex-1 min-w-0 overflow-x-auto py-2.5 px-3">
                                        <code className={`text-[11px] font-mono break-all whitespace-pre-wrap ${
                                            isUninstall ? "text-red-300/90" : "text-orange-300/90"
                                        }`} style={{ wordBreak: 'break-all' }}>
                                            {activeCommand}
                                        </code>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={copyCommand}
                                        className="px-3 rounded-none border-l border-border/30 text-muted-foreground hover:text-foreground hover:bg-white/5 shrink-0 self-stretch gap-1.5"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[10px] text-emerald-400">Copied</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3 h-3" />
                                                <span className="text-[10px]">Copy</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Info banner */}
                            {!isUninstall && (
                                <div className="text-[10px] text-amber-400/70 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2">
                                    💡 This command is pre-filled with your credentials. Just copy, paste into your VPS terminal, and you&apos;re done — takes about 30 seconds.
                                </div>
                            )}

                            {/* Requirements */}
                            <div className="text-[10px] text-muted-foreground/50 flex items-center gap-3">
                                <span>
                                    {mode === "docker"
                                        ? "Requires: SSH access to your VPS host, Docker running"
                                        : "Requires: Node.js 18+, npm, SSH access to your server"}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
