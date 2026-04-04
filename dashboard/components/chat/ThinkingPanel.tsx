"use client";

import React, { useState } from "react";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingPanelProps {
    text: string;
    isStreaming?: boolean;
    className?: string;
}

export function ThinkingPanel({ text, isStreaming = false, className }: ThinkingPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!text) return null;

    return (
        <div
            className={cn(
                "rounded-md border border-border/50 overflow-hidden transition-all duration-200",
                "bg-zinc-900/40 backdrop-blur-sm",
                className
            )}
        >
            {/* Header — always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors select-none"
            >
                {isExpanded ? (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                ) : (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                )}
                <Brain className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    isStreaming && "text-violet-400"
                )} />
                <span className="font-medium">
                    {isStreaming ? "Thinking" : "Thought Process"}
                </span>
                {isStreaming && (
                    <span className="flex items-center gap-1 ml-1">
                        <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
                        <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: "0.2s" }} />
                        <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </span>
                )}
                {!isExpanded && (
                    <span className="text-[10px] text-muted-foreground/60 ml-auto truncate max-w-[200px]">
                        {text.slice(0, 80)}…
                    </span>
                )}
            </button>

            {/* Expandable content */}
            {isExpanded && (
                <div className="px-3 pb-3 animate-in slide-in-from-top-1 fade-in duration-200">
                    <div className="border-t border-border/30 pt-2">
                        <pre
                            className={cn(
                                "text-[11px] leading-relaxed whitespace-pre-wrap break-words font-mono",
                                "text-muted-foreground/80 italic",
                                "max-h-[300px] overflow-y-auto scrollbar-thin"
                            )}
                        >
                            {text}
                            {isStreaming && (
                                <span className="inline-block w-1.5 h-3 bg-violet-400/60 animate-pulse ml-0.5 align-middle" />
                            )}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
}
