"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Puzzle, Loader2, Copy, Check, ChevronUp, Terminal,
    CheckCircle2, Package, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export function PluginInstall() {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [installCommand, setInstallCommand] = useState("");
    const [copied, setCopied] = useState(false);

    const handleShowCommand = useCallback(async () => {
        if (expanded && installCommand) {
            setExpanded(false);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/plugin/handshake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to load install command");
            if (!data.installCommand && !data.steps?.length) throw new Error("No install command returned");

            setInstallCommand(data.installCommand || data.steps[0].command);
            setExpanded(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to load install command");
        } finally {
            setLoading(false);
        }
    }, [expanded, installCommand]);

    const copyCommand = useCallback(async () => {
        await navigator.clipboard.writeText(installCommand);
        setCopied(true);
        toast.success("Command copied to clipboard!");
        setTimeout(() => setCopied(false), 2500);
    }, [installCommand]);

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

                    <Button
                        onClick={handleShowCommand}
                        disabled={loading}
                        size="sm"
                        className="rounded-full h-8 px-4 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1.5 shrink-0"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Loading...
                            </>
                        ) : expanded ? (
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
                </div>

                {/* Install command */}
                <AnimatePresence>
                    {expanded && installCommand && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 overflow-hidden"
                        >
                            {/* What it does */}
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
                                    Auto-restarts gateway
                                </span>
                            </div>

                            {/* Command block */}
                            <div className="group overflow-hidden">
                                <p className="text-[10px] text-muted-foreground/70 mb-1.5 font-medium">
                                    Paste this into your OpenClaw server terminal:
                                </p>
                                <div className="flex items-stretch bg-[#0d0d0d] border border-border/40 rounded-md overflow-hidden">
                                    <div className="flex-1 min-w-0 overflow-x-auto py-2.5 px-3">
                                        <code className="text-[11px] text-orange-300/90 font-mono break-all whitespace-pre-wrap" style={{ wordBreak: 'break-all' }}>
                                            {installCommand}
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
                            <div className="text-[10px] text-amber-400/70 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2">
                                💡 This command is pre-filled with your credentials. Just copy, paste into your VPS terminal, and you're done — takes about 30 seconds.
                            </div>

                            {/* Requirements */}
                            <div className="text-[10px] text-muted-foreground/50 flex items-center gap-3">
                                <span>Requires: Node.js 18+, npm, SSH access to your OpenClaw server</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
