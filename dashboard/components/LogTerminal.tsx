"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function LogTerminal({ logs }: { logs: string[] }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="flex flex-col h-full bg-background border border-border rounded-md text-xs overflow-hidden">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-accent/50">
                <span className="text-muted-foreground text-xs">System Logs</span>
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500/30" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/30" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500/30" />
                </div>
            </div>

            {/* Terminal Body */}
            <div
                ref={scrollRef}
                className="flex-1 p-4 overflow-y-auto space-y-1 font-mono text-[10px] sm:text-xs text-muted-foreground max-h-[300px]"
            >
                {logs.length === 0 && (
                    <span className="text-muted-foreground/50 italic">Waiting for events...</span>
                )}
                {logs.map((log, index) => (
                    <div key={index} className="flex gap-2 font-mono">
                        <span className="text-muted-foreground/30">
                            [{mounted ? new Date().toLocaleTimeString() : '--:--:--'}]
                        </span>
                        <span className={cn(
                            "break-words",
                            log.includes("Error") || log.includes("❌") ? "text-red-400" :
                                log.includes("Success") || log.includes("✅") ? "text-emerald-500" :
                                    "text-muted-foreground"
                        )}>
                            {log}
                        </span>
                    </div>
                ))}
                {/* Typing Cursor */}
                <div className="animate-pulse text-muted-foreground/40">_</div>
            </div>
        </div>
    );
}
