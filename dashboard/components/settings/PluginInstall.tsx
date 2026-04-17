"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Puzzle, Loader2, Copy, Check, ChevronDown, ChevronUp, Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface InstallStep {
    label: string;
    command: string;
}

export function PluginInstall() {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [steps, setSteps] = useState<InstallStep[]>([]);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [copiedAll, setCopiedAll] = useState(false);

    const handleShowSteps = useCallback(async () => {
        if (expanded && steps.length > 0) {
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

            if (!res.ok) throw new Error(data.error || "Failed to load install steps");
            if (!data.steps?.length) throw new Error("No install steps returned");

            setSteps(data.steps);
            setExpanded(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to load install commands");
        } finally {
            setLoading(false);
        }
    }, [expanded, steps]);

    const copyCommand = useCallback(async (command: string, idx: number) => {
        await navigator.clipboard.writeText(command);
        setCopiedIdx(idx);
        toast.success("Copied!");
        setTimeout(() => setCopiedIdx(null), 2000);
    }, []);

    const copyAll = useCallback(async () => {
        const allCommands = steps.map((s) => s.command).join("\n");
        await navigator.clipboard.writeText(allCommands);
        setCopiedAll(true);
        toast.success("All commands copied!");
        setTimeout(() => setCopiedAll(false), 2000);
    }, [steps]);

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
                                Install once — every agent gets the tools automatically.
                            </p>
                        </div>
                    </div>

                    <Button
                        onClick={handleShowSteps}
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
                                Hide Steps
                            </>
                        ) : (
                            <>
                                <Terminal className="w-3 h-3" />
                                Install Plugin
                            </>
                        )}
                    </Button>
                </div>

                {/* Install steps */}
                <AnimatePresence>
                    {expanded && steps.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2 overflow-hidden"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] text-muted-foreground">
                                    Run these commands in your OpenClaw terminal:
                                </p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={copyAll}
                                    className="h-6 px-2 text-[10px] rounded gap-1 text-muted-foreground hover:text-foreground"
                                >
                                    {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    {copiedAll ? "Copied all" : "Copy all"}
                                </Button>
                            </div>

                            {steps.map((step, idx) => (
                                <div key={idx} className="group overflow-hidden">
                                    <p className="text-[10px] text-muted-foreground/70 mb-1 font-medium">
                                        {idx + 1}. {step.label}
                                    </p>
                                    <div className="flex items-stretch bg-[#0d0d0d] border border-border/40 rounded-md overflow-hidden">
                                        <div className="flex-1 min-w-0 overflow-x-auto py-2 px-3">
                                            <code className="text-[11px] text-orange-300/90 font-mono break-all whitespace-pre-wrap" style={{ wordBreak: 'break-all' }}>
                                                {step.command}
                                            </code>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyCommand(step.command, idx)}
                                            className="px-2.5 rounded-none border-l border-border/30 text-muted-foreground hover:text-foreground hover:bg-white/5 shrink-0 self-stretch"
                                        >
                                            {copiedIdx === idx ? (
                                                <Check className="w-3 h-3 text-emerald-400" />
                                            ) : (
                                                <Copy className="w-3 h-3" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div className="text-[10px] text-amber-400/70 bg-amber-500/5 border border-amber-500/15 rounded-md px-3 py-2 mt-1">
                                💡 These commands are pre-filled with your credentials. Just copy and paste — no editing needed.
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}
