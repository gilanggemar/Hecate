"use client";

import React from "react";
import { Terminal, ShieldAlert, Folder, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ExecApprovalRequest } from "@/store/useOpenClawStore";

interface ExecApprovalModalProps {
    approval: ExecApprovalRequest;
    onApprove: (id: string) => void;
    onDeny: (id: string) => void;
}

export function ExecApprovalModal({ approval, onApprove, onDeny }: ExecApprovalModalProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={cn(
                    "w-full max-w-lg mx-4 rounded-md border border-border/60",
                    "bg-zinc-900/90 backdrop-blur-xl shadow-2xl shadow-black/40",
                    "animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                )}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                    <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Exec Approval Required</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Agent is requesting permission to run a command
                        </p>
                    </div>
                </div>

                {/* Command details */}
                <div className="px-5 py-3 space-y-3">
                    {/* Command */}
                    <div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">
                            <Terminal className="w-3 h-3" /> Command
                        </div>
                        <pre className="text-xs font-mono text-foreground bg-background/80 border border-border rounded-lg p-3 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                            {approval.command}
                        </pre>
                    </div>

                    {/* Working directory */}
                    {approval.workingDir && (
                        <div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">
                                <Folder className="w-3 h-3" /> Working Directory
                            </div>
                            <code className="text-[11px] font-mono text-muted-foreground bg-background/50 border border-border rounded-md px-2 py-1 block">
                                {approval.workingDir}
                            </code>
                        </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        {approval.agentId && (
                            <span>Agent: <span className="text-foreground font-medium">{approval.agentId}</span></span>
                        )}
                        <span>Session: <span className="text-foreground font-medium">{approval.sessionKey}</span></span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-5 pb-5 pt-2">
                    <Button
                        onClick={() => onDeny(approval.id)}
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-md h-9 text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50"
                    >
                        <X className="w-3.5 h-3.5" />
                        Deny
                    </Button>
                    <Button
                        onClick={() => onApprove(approval.id)}
                        size="sm"
                        className="flex-1 rounded-md h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                    >
                        <Check className="w-3.5 h-3.5" />
                        Approve
                    </Button>
                </div>
            </div>
        </div>
    );
}
