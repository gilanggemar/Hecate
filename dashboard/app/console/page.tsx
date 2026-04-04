"use client";

import { useSocketStore } from "@/lib/useSocket";
import { useTaskStore, Task } from "@/lib/useTaskStore";
import { cn } from "@/lib/utils";
import {
    Terminal, PlayCircle, CheckCircle2, AlertCircle,
    ChevronDown, Bot, Loader2, Clock
} from "lucide-react";
import { ToolNodeCard } from "@/components/ToolNodeCard";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from "react";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { ConsoleFilters, LogSeverity } from "@/components/ConsoleFilters";

export default function ConsolePage() {
    const { logs, agents } = useSocketStore();
    const { tasks } = useTaskStore();
    const [selectedAgent, setSelectedAgent] = useState<string>("all");
    const [activeFilters, setActiveFilters] = useState<LogSeverity[]>(["info", "warn", "error"]);

    const filteredTasks = useMemo(() => {
        if (selectedAgent === "all") return tasks;
        return tasks.filter(t => t.agentId === selectedAgent);
    }, [tasks, selectedAgent]);

    const statusIcon = (status: string) => {
        switch (status) {
            case "IN_PROGRESS": return <Loader2 className="w-3 h-3 animate-spin text-blue-400" />;
            case "DONE": return <CheckCircle2 className="w-3 h-3 text-emerald-500" />;
            case "FAILED": return <AlertCircle className="w-3 h-3 text-red-400" />;
            default: return <Clock className="w-3 h-3 text-muted-foreground" />;
        }
    };

    // Parse log severity based on keywords/emojis since logs are strings
    const getLogSeverity = (log: string): LogSeverity => {
        const lowerLog = log.toLowerCase();
        if (lowerLog.includes("error") || lowerLog.includes("fail") || log.includes("❌") || log.includes("⚠️") || lowerLog.includes("exception")) return 'error';
        if (lowerLog.includes("warn") || log.includes("🚧")) return 'warn';
        if (lowerLog.includes("debug") || log.includes("🐛") || log.includes("[debug]")) return 'debug';
        return 'info'; // default
    };

    const parsedLogs = useMemo(() => {
        return logs.map((log, index) => ({
            id: index,
            text: log,
            severity: getLogSeverity(log)
        }));
    }, [logs]);

    const filteredLogs = useMemo(() => {
        if (activeFilters.length === 0) return parsedLogs;
        return parsedLogs.filter(log => activeFilters.includes(log.severity));
    }, [parsedLogs, activeFilters]);

    // Calculate counts for filters
    const counts = useMemo(() => {
        return {
            info: parsedLogs.filter(l => l.severity === 'info').length,
            warn: parsedLogs.filter(l => l.severity === 'warn').length,
            error: parsedLogs.filter(l => l.severity === 'error').length,
            debug: parsedLogs.filter(l => l.severity === 'debug').length,
        };
    }, [parsedLogs]);

    const getLogColor = (severity: LogSeverity) => {
        switch (severity) {
            case 'error': return 'text-red-400 font-medium';
            case 'warn': return 'text-amber-400';
            case 'debug': return 'text-zinc-500';
            default: return 'text-muted-foreground';
        }
    };

    return (
        <div className="flex flex-col h-full gap-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Console</h1>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger className="w-44 h-8 text-xs rounded-full border-border bg-transparent text-muted-foreground gap-2">
                        <SelectValue placeholder="Filter agent" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                        <SelectItem value="all" className="text-xs rounded-md">All Agents</SelectItem>
                        {agents.map((a: any) => {
                            const id = a.accountId || a.name || a.id;
                            const label = a.accountId
                                ? a.accountId.charAt(0).toUpperCase() + a.accountId.slice(1)
                                : a.name || a.id;
                            return (
                                <SelectItem key={id} value={id} className="text-xs rounded-md">
                                    {label}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                {/* Gateway Logs */}
                <div className="flex flex-col gap-3 min-h-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5" /> Gateway Logs
                        </h2>
                        <ConsoleFilters
                            activeFilters={activeFilters}
                            onFilterChange={setActiveFilters}
                            counts={counts}
                        />
                    </div>

                    <Card className="flex-1 bg-card border-border rounded-md py-0 gap-0 shadow-none overflow-hidden">
                        <ScrollArea className="h-full">
                            {filteredLogs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60 gap-2 p-8">
                                    <Terminal className="w-8 h-8" />
                                    <p className="text-xs">
                                        {logs.length > 0 ? "No logs match the current filters." : "Waiting for events..."}
                                    </p>
                                </div>
                            ) : (
                                <div className="p-2 font-mono text-xs space-y-0.5">
                                    {filteredLogs.map((log) => (
                                        <div
                                            key={log.id}
                                            className={cn(
                                                "flex gap-2 py-0.5 px-1 hover:bg-accent rounded-lg transition-colors",
                                                getLogColor(log.severity)
                                            )}
                                        >
                                            <span className="text-muted-foreground/30 shrink-0 select-none w-7 text-right">{log.id + 1}</span>
                                            <span className="break-all">{log.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </Card>
                </div>

                {/* Execution Monitor */}
                <div className="flex flex-col gap-3 min-h-0">
                    <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <PlayCircle className="w-3.5 h-3.5" /> Execution Monitor
                    </h2>
                    <Card className="flex-1 bg-card border-border rounded-md py-0 gap-0 shadow-none overflow-hidden">
                        <ScrollArea className="h-full">
                            {filteredTasks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60 gap-2 p-8">
                                    <Bot className="w-8 h-8" />
                                    <p className="text-xs">No active operations</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-1.5">
                                    {filteredTasks.map((task: Task) => (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "flex items-center gap-3 py-2 px-2.5 rounded-md border transition-all",
                                                task.status === "IN_PROGRESS" ? "border-blue-500/20 bg-blue-500/5" :
                                                    task.status === "FAILED" ? "border-red-500/20 bg-red-500/5" :
                                                        "border-border bg-accent/50"
                                            )}
                                        >
                                            {statusIcon(task.status)}

                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                                                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                    <AgentAvatar agentId={task.agentId} size={14} className="opacity-70" />
                                                    <span className="capitalize">{task.agentId}</span>
                                                    <span>· {task.timestamp}</span>
                                                </p>
                                            </div>

                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    "text-[10px] h-5 px-2 rounded-full font-medium",
                                                    task.status === "IN_PROGRESS" ? "text-blue-400 border-blue-500/30" :
                                                        task.status === "DONE" ? "text-emerald-500 border-emerald-500/30" :
                                                            task.status === "FAILED" ? "text-red-400 border-red-500/30" :
                                                                "text-muted-foreground border-border"
                                                )}
                                            >
                                                {task.status}
                                            </Badge>
                                        </div>
                                    ))}

                                    {/* Tool Calls */}
                                    {filteredTasks
                                        .filter(t => t.toolCalls && t.toolCalls.length > 0)
                                        .map(task => task.toolCalls?.map((tc, idx) => (
                                            <div key={`${task.id}-tc-${idx}`} className="pl-6">
                                                <ToolNodeCard tc={tc} />
                                            </div>
                                        )))
                                    }
                                </div>
                            )}
                        </ScrollArea>
                    </Card>
                </div>
            </div>
        </div>
    );
}
