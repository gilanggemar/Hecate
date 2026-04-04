"use client";

import React, { useState } from 'react';
import {
    Loader2, CheckCircle2, AlertCircle, Terminal, Code2,
    ChevronRight, ChevronDown, Search, Globe, FileText, Edit3,
    Chrome, Send, Layout, Clock, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToolCallData {
    id?: string;
    status?: 'in_progress' | 'completed' | 'failed' | 'running' | 'error';
    function?: { name: string; arguments: string };
    // New shape from OpenClawStore
    toolName?: string;
    input?: any;
    output?: string;
    error?: string;
    progress?: string;
    isAgentEvent?: boolean;
    startedAt?: number;
    completedAt?: number;
}

// Map tool names to icons and color accents
function getToolMeta(name: string): { icon: React.ReactNode; colorClass: string } {
    const n = (name || '').toLowerCase();
    if (n === 'exec' || n === 'terminal' || n === 'shell' || n === 'bash') {
        return { icon: <Terminal className="w-3.5 h-3.5" />, colorClass: 'text-teal-400' };
    }
    if (n === 'web_search' || n === 'search' || n === 'google_search') {
        return { icon: <Search className="w-3.5 h-3.5" />, colorClass: 'text-blue-400' };
    }
    if (n === 'web_fetch' || n === 'fetch' || n === 'http') {
        return { icon: <Globe className="w-3.5 h-3.5" />, colorClass: 'text-blue-400' };
    }
    if (n === 'read' || n === 'read_file' || n === 'file_read') {
        return { icon: <FileText className="w-3.5 h-3.5" />, colorClass: 'text-lime-400' };
    }
    if (n === 'write' || n === 'write_file' || n === 'file_write' || n === 'edit') {
        return { icon: <Edit3 className="w-3.5 h-3.5" />, colorClass: 'text-lime-400' };
    }
    if (n === 'browser' || n === 'web_browser' || n === 'puppeteer') {
        return { icon: <Chrome className="w-3.5 h-3.5" />, colorClass: 'text-violet-400' };
    }
    if (n === 'message' || n === 'send_message' || n === 'chat') {
        return { icon: <Send className="w-3.5 h-3.5" />, colorClass: 'text-rose-400' };
    }
    if (n === 'canvas' || n === 'layout') {
        return { icon: <Layout className="w-3.5 h-3.5" />, colorClass: 'text-violet-400' };
    }
    if (n === 'cron' || n === 'schedule') {
        return { icon: <Clock className="w-3.5 h-3.5" />, colorClass: 'text-amber-400' };
    }
    return { icon: <Wrench className="w-3.5 h-3.5" />, colorClass: 'text-orange-400' };
}

export interface ToolNodeCardProps {
    tc: ToolCallData;
    isLive?: boolean;
}

export const ToolNodeCard = ({ tc, isLive }: ToolNodeCardProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Normalize status from either old or new shape
    const normalizedStatus = tc.status === 'running' ? 'in_progress'
        : tc.status === 'error' ? 'failed'
            : tc.status;

    const inProgress = normalizedStatus === 'in_progress' || isLive;
    const isError = normalizedStatus === 'failed';
    const isSuccess = normalizedStatus === 'completed' && !tc.error;
    const isAgent = tc.isAgentEvent;

    // Get tool name from either old or new shape
    const toolName = tc.function?.name || tc.toolName || 'unknown_tool';
    const { icon: toolIcon, colorClass: toolColor } = getToolMeta(toolName);

    // Parse arguments
    let parsedArgs = tc.function?.arguments;
    if (!parsedArgs && tc.input) {
        parsedArgs = typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input, null, 2);
    }
    try {
        if (parsedArgs && typeof parsedArgs === 'string') {
            const parsed = JSON.parse(parsedArgs);
            parsedArgs = parsed.command ? parsed.command : JSON.stringify(parsed, null, 2);
        }
    } catch (_e) { /* leave as-is if not valid JSON */ }

    // Duration display
    let durationStr = '';
    if (tc.startedAt && tc.completedAt) {
        const ms = tc.completedAt - tc.startedAt;
        durationStr = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
    }

    return (
        <div className={cn(
            "animate-in fade-in slide-in-from-bottom-2 duration-300",
            "border rounded-md p-3 w-full text-sm transition-all",
            inProgress ? "bg-accent border-border" :
                isError ? "bg-red-500/5 border-red-500/20" :
                    "bg-accent/50 border-border",
            inProgress && isLive && "ring-1 ring-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.1)]"
        )}>
            {/* Header: Tool name + status */}
            <div
                className={cn(
                    "flex items-center justify-between cursor-pointer select-none",
                    isExpanded ? "mb-2 pb-2 border-b border-border" : ""
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2 text-xs font-medium">
                    {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}

                    {inProgress && <Loader2 className={cn("w-3.5 h-3.5 animate-spin", toolColor)} />}
                    {isSuccess && <CheckCircle2 className={cn("w-3.5 h-3.5", isAgent ? "text-amber-500" : "text-emerald-500")} />}
                    {isError && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}

                    <span className={cn(toolColor)}>{toolIcon}</span>
                    <span className={cn(
                        isError ? "text-red-400" : (isAgent ? "text-amber-400" : "text-foreground")
                    )}>
                        {toolName} {isAgent ? '(Agent Event)' : null}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                    {durationStr && <span className="text-muted-foreground/60">{durationStr}</span>}
                    {inProgress && <span className="text-blue-400 animate-pulse">Running</span>}
                    {isSuccess && <span className={cn(isAgent ? "text-amber-500" : "text-emerald-500")}>Done</span>}
                    {isError && <span className="text-red-400">Failed</span>}
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="animate-in slide-in-from-top-1 fade-in duration-200">
                    {/* Arguments block */}
                    <div className="mb-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1 mt-1">
                            <Code2 className="w-3 h-3" /> {isAgent ? 'Event Payload' : 'Arguments'}
                        </div>
                        <pre className={cn(
                            "text-[11px] p-2.5 rounded-lg bg-background border border-border overflow-x-auto whitespace-pre-wrap break-all font-mono",
                            isError ? "text-red-400/70" : "text-muted-foreground"
                        )}>
                            {parsedArgs || 'No payload provided.'}
                        </pre>
                    </div>

                    {/* Progress indicator */}
                    {tc.progress && inProgress && (
                        <div className="mb-2">
                            <div className="text-[10px] text-blue-400/70 font-mono animate-pulse">
                                ⟫ {tc.progress}
                            </div>
                        </div>
                    )}

                    {/* Output / Error block */}
                    {(tc.output || tc.error) && !inProgress && (
                        <div className="animate-in fade-in zoom-in-95 duration-200 mt-2">
                            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
                                <Terminal className="w-3 h-3" /> Output
                            </div>
                            <div className={cn(
                                "text-[11px] p-2.5 rounded-lg overflow-x-auto font-mono whitespace-pre-wrap border",
                                isError
                                    ? "bg-red-500/5 text-red-400 border-red-500/20"
                                    : "bg-background text-muted-foreground border-border"
                            )}>
                                {tc.error || tc.output}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
