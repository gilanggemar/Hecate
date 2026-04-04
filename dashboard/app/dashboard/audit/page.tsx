"use client";

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Download, Filter, ChevronLeft, ChevronRight,
    FileText, FileCode, Terminal, MessageSquare, AlertTriangle,
    CheckCircle, Play, Users, Zap, Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuditStore } from "@/store/useAuditStore";
import { DiffViewer } from "@/components/DiffViewer";

const ACTION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
    'task.started': { label: 'Task Started', icon: Play, color: 'text-blue-400' },
    'task.completed': { label: 'Task Completed', icon: CheckCircle, color: 'text-emerald-400' },
    'task.failed': { label: 'Task Failed', icon: AlertTriangle, color: 'text-red-400' },
    'file.created': { label: 'File Created', icon: FileText, color: 'text-emerald-400' },
    'file.modified': { label: 'File Modified', icon: FileCode, color: 'text-amber-400' },
    'file.deleted': { label: 'File Deleted', icon: FileText, color: 'text-red-400' },
    'command.executed': { label: 'Command', icon: Terminal, color: 'text-purple-400' },
    'summit.joined': { label: 'Summit Joined', icon: Users, color: 'text-blue-400' },
    'consensus.reached': { label: 'Consensus', icon: Zap, color: 'text-amber-400' },
    'message.sent': { label: 'Message', icon: MessageSquare, color: 'text-foreground' },
    'tool.called': { label: 'Tool Call', icon: Code, color: 'text-purple-400' },
    'tool.completed': { label: 'Tool Done', icon: CheckCircle, color: 'text-emerald-400' },
    'error.occurred': { label: 'Error', icon: AlertTriangle, color: 'text-red-400' },
};

const ACTION_OPTIONS = [
    { value: 'all', label: 'All Actions' },
    { value: 'task.started', label: 'Task Started' },
    { value: 'task.completed', label: 'Task Completed' },
    { value: 'task.failed', label: 'Task Failed' },
    { value: 'file.created', label: 'File Created' },
    { value: 'file.modified', label: 'File Modified' },
    { value: 'command.executed', label: 'Command Executed' },
    { value: 'summit.joined', label: 'Summit Joined' },
    { value: 'consensus.reached', label: 'Consensus Reached' },
    { value: 'error.occurred', label: 'Error' },
];

export default function AuditPage() {
    const {
        entries, total, isLoading, page,
        filterAgent, filterAction,
        setPage, setFilterAgent, setFilterAction, fetchLogs,
    } = useAuditStore();

    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs, page, filterAgent, filterAction]);

    const handleExport = useCallback((format: 'json' | 'csv') => {
        const params = new URLSearchParams({ format });
        if (filterAgent && filterAgent !== 'all') params.set('agentId', filterAgent);
        if (filterAction && filterAction !== 'all') params.set('action', filterAction);
        window.open(`/api/audit/export?${params}`, '_blank');
    }, [filterAgent, filterAction]);

    const totalPages = Math.ceil(total / 50);

    // Filter entries by search
    const filteredEntries = searchQuery
        ? entries.filter((e) =>
            e.action.includes(searchQuery) ||
            e.agentId.includes(searchQuery) ||
            (e.details || '').includes(searchQuery)
        )
        : entries;

    return (
        <div className="flex flex-col h-full gap-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Audit Trail</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost" size="sm"
                        className="h-8 px-3 text-xs rounded-full text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => handleExport('json')}
                    >
                        <Download className="w-3 h-3" /> JSON
                    </Button>
                    <Button
                        variant="ghost" size="sm"
                        className="h-8 px-3 text-xs rounded-full text-muted-foreground hover:text-foreground gap-1.5"
                        onClick={() => handleExport('csv')}
                    >
                        <Download className="w-3 h-3" /> CSV
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search logs..."
                        className="h-8 pl-9 text-[12px] rounded-md border-border bg-background"
                    />
                </div>

                <Select value={filterAgent} onValueChange={setFilterAgent}>
                    <SelectTrigger className="h-8 w-36 text-[12px] rounded-md border-border bg-background">
                        <SelectValue placeholder="All Agents" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                        <SelectItem value="all" className="text-xs rounded-lg">All Agents</SelectItem>
                        <SelectItem value="daisy" className="text-xs rounded-lg">Daisy</SelectItem>
                        <SelectItem value="ivy" className="text-xs rounded-lg">Ivy</SelectItem>
                        <SelectItem value="celia" className="text-xs rounded-lg">Celia</SelectItem>
                        <SelectItem value="thalia" className="text-xs rounded-lg">Thalia</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filterAction} onValueChange={setFilterAction}>
                    <SelectTrigger className="h-8 w-44 text-[12px] rounded-md border-border bg-background">
                        <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                        {ACTION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs rounded-lg">
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Timeline */}
            <ScrollArea className="flex-1">
                <div className="space-y-1.5 pb-6">
                    {filteredEntries.length === 0 && !isLoading && (
                        <Card className="rounded-md border-dashed border-border bg-card/50 shadow-none">
                            <CardContent className="p-8 text-center">
                                <FileText className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                                <p className="text-sm text-muted-foreground">No audit entries found.</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Agent actions will appear here as they occur.</p>
                            </CardContent>
                        </Card>
                    )}

                    <AnimatePresence mode="popLayout">
                        {filteredEntries.map((entry) => {
                            const meta = ACTION_LABELS[entry.action] || {
                                label: entry.action,
                                icon: Zap,
                                color: 'text-muted-foreground',
                            };
                            const Icon = meta.icon;
                            const isExpanded = expandedId === entry.id;
                            const time = new Date(entry.timestamp);

                            return (
                                <motion.div
                                    key={entry.id}
                                    layout
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <Card
                                        className="rounded-md border-border bg-card shadow-none py-0 gap-0 cursor-pointer hover:border-foreground/10 transition-colors"
                                        onClick={() => setExpandedId(isExpanded ? null : (entry.id ?? null))}
                                    >
                                        <CardContent className="p-3">
                                            <div className="flex items-center gap-3">
                                                {/* Icon */}
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-accent/50 ${meta.color}`}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-foreground">{meta.label}</span>
                                                        <Badge variant="secondary" className="text-[10px] h-4 rounded px-1.5 font-normal">
                                                            {entry.agentId}
                                                        </Badge>
                                                    </div>
                                                    {entry.details && (
                                                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                            {(() => {
                                                                try {
                                                                    const d = JSON.parse(entry.details);
                                                                    return d.description || d.message || d.path || entry.details.slice(0, 80);
                                                                } catch {
                                                                    return entry.details.slice(0, 80);
                                                                }
                                                            })()}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Timestamp */}
                                                <span className="text-[10px] text-muted-foreground/50 shrink-0">
                                                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    <span className="hidden md:inline ml-1.5">
                                                        {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </span>
                                            </div>

                                            {/* Expanded diff viewer */}
                                            <AnimatePresence>
                                                {isExpanded && entry.diffPayload && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="mt-3 overflow-hidden"
                                                    >
                                                        <DiffViewer diffPayload={entry.diffPayload} />
                                                    </motion.div>
                                                )}
                                                {isExpanded && entry.details && !entry.diffPayload && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="mt-3 overflow-hidden"
                                                    >
                                                        <pre className="text-[11px] text-muted-foreground bg-accent/30 rounded-lg p-3 overflow-x-auto font-mono">
                                                            {(() => {
                                                                try { return JSON.stringify(JSON.parse(entry.details), null, 2); }
                                                                catch { return entry.details; }
                                                            })()}
                                                        </pre>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                    <p className="text-[11px] text-muted-foreground">{total} entries</p>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 rounded-lg"
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-[11px] text-muted-foreground px-2">
                            {page + 1} / {totalPages}
                        </span>
                        <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 rounded-lg"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(page + 1)}
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
