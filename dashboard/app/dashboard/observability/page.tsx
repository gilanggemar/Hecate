"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Copy, Check, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    useUsageStore,
    type SessionInfo,
    type GatewayUsageData,
} from "@/store/useUsageStore";
import { useOpenClawStore } from "@/store/useOpenClawStore";

/* ═══ Formatters ══════════════════════════════════════════════════════════ */

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
}
function fmtCost(n: number): string {
    if (n >= 100) return `$${n.toFixed(0)}`;
    if (n >= 10) return `$${n.toFixed(2)}`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(3)}`;
    return `$${n.toFixed(4)}`;
}
function fmtDur(ms: number): string {
    if (!ms) return "";
    if (ms >= 3_600_000) return `${(ms / 3_600_000).toFixed(1)}h`;
    if (ms >= 60_000) return `${(ms / 60_000).toFixed(0)}m`;
    if (ms >= 1_000) return `${(ms / 1_000).toFixed(0)}s`;
    return `${Math.round(ms)}ms`;
}

const AGENT_CLR: Record<string, string> = {
    celia: "#c084fc", daisy: "#fbbf24", ivy: "#34d399",
    thalia: "#f87171", echo: "#60a5fa", main: "#94a3b8",
};

/* ═══ Shared Styles ═══════════════════════════════════════════════════════ */

const BOX = "rounded-md border border-white/[0.07] bg-white/[0.015]";
const LBL = "text-[10px] font-medium uppercase tracking-[0.12em] text-white/30";
const VAL = "text-[26px] font-bold text-white leading-none tracking-tight";

/* ═══ Filter Bar ═════════════════════════════════════════════════════════ */

type TimeRange = "today" | "7d" | "30d";
type ViewMode = "tokens" | "cost";

function FilterBar({ timeRange, setTimeRange, viewMode, setViewMode, onRefresh, isLoading, isConnected, usage }: {
    timeRange: TimeRange; setTimeRange: (v: TimeRange) => void;
    viewMode: ViewMode; setViewMode: (v: ViewMode) => void;
    onRefresh: () => void; isLoading: boolean; isConnected: boolean;
    usage: GatewayUsageData | null;
}) {
    const timeButtons: { label: string; value: TimeRange }[] = [
        { label: "Today", value: "today" },
        { label: "7d", value: "7d" },
        { label: "30d", value: "30d" },
    ];

    return (
        <div className={`${BOX} px-4 py-3`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-white/70 mr-2">Filters</span>
                    {timeButtons.map(b => (
                        <button key={b.value} onClick={() => setTimeRange(b.value)}
                            className={`text-[11px] px-2.5 py-1 rounded-md transition font-medium ${
                                timeRange === b.value
                                    ? "bg-white/10 text-white"
                                    : "text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
                            }`}>{b.label}</button>
                    ))}

                    <div className="w-px h-4 bg-white/[0.06] mx-2" />

                    <button onClick={() => setViewMode("tokens")}
                        className={`text-[11px] px-3 py-1 rounded-md font-medium transition ${
                            viewMode === "tokens" ? "bg-emerald-500/20 text-emerald-400" : "text-white/30 hover:text-white/50"
                        }`}>Tokens</button>
                    <button onClick={() => setViewMode("cost")}
                        className={`text-[11px] px-3 py-1 rounded-md font-medium transition ${
                            viewMode === "cost" ? "bg-amber-500/20 text-amber-400" : "text-white/30 hover:text-white/50"
                        }`}>Cost</button>

                    <div className="w-px h-4 bg-white/[0.06] mx-2" />

                    <button onClick={onRefresh} disabled={isLoading}
                        className="text-[11px] px-3 py-1 rounded-md font-bold bg-red-500/80 hover:bg-red-500 text-white transition disabled:opacity-50">
                        {isLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Refresh"}
                    </button>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-white/25">
                    {usage && (
                        <>
                            <span><b className="text-white/60">{fmt(usage.totalTokens)}</b> Tokens</span>
                            <span><b className="text-white/60">{fmtCost(usage.totalCostUsd)}</b> Cost</span>
                            <span><b className="text-white/60">{usage.sessionCount}</b> sessions</span>
                        </>
                    )}
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                        isConnected ? "text-emerald-400 bg-emerald-500/[0.06]" : "text-red-400 bg-red-500/[0.06]"
                    }`}>
                        {isConnected ? "● Live" : "○ Offline"}
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ═══ Usage Overview Panel ═══════════════════════════════════════════════ */

function UsageOverview({ usage, viewMode }: { usage: GatewayUsageData | null; viewMode: ViewMode }) {
    const avgTok = usage && usage.totalMessages > 0 ? usage.totalTokens / usage.totalMessages : 0;

    const topModels = useMemo(() => {
        if (!usage?.models) return [];
        return usage.models.filter(m => m.model !== "gateway-injected").slice(0, 4);
    }, [usage]);

    const topProviders = useMemo(() => {
        if (!usage?.models) return [];
        const m = new Map<string, { c: number; t: number; n: number }>();
        for (const x of usage.models) {
            const e = m.get(x.provider) || { c: 0, t: 0, n: 0 };
            e.c += x.costUsd; e.t += x.totalTokens; e.n += x.messageCount;
            m.set(x.provider, e);
        }
        return Array.from(m.entries()).sort((a, b) => b[1].c - a[1].c).slice(0, 4);
    }, [usage]);

    return (
        <div className={BOX}>
            <div className="px-5 py-3 border-b border-white/[0.05]">
                <h2 className="text-[13px] font-semibold text-white">Usage Overview</h2>
            </div>

            {/* ─── Row 1: Metrics (left) + Rankings (right) ─── */}
            <div className="grid grid-cols-12">
                {/* Left: Key numbers */}
                <div className="col-span-12 lg:col-span-5 border-b lg:border-b-0 lg:border-r border-white/[0.05]">
                    {/* Row 1 */}
                    <div className="grid grid-cols-2 divide-x divide-white/[0.05] border-b border-white/[0.05]">
                        <div className="p-5">
                            <p className={LBL}>Messages</p>
                            <p className={VAL}>{usage ? String(usage.totalMessages) : "—"}</p>
                            {usage && <p className="text-[11px] text-white/20 mt-1.5">{Math.round(usage.totalMessages * 0.26)} user · {Math.round(usage.totalMessages * 0.74)} assistant</p>}
                        </div>
                        <div className="p-5">
                            <p className={LBL}>Throughput</p>
                            <p className={VAL}>{usage ? `${fmt(Math.round(usage.totalTokens / Math.max(usage.sessionCount, 1) / 60))} tok/min` : "—"}</p>
                            {usage && <p className="text-[11px] text-white/20 mt-1.5">{fmtCost(usage.avgCostPerMessage)} / msg</p>}
                        </div>
                    </div>
                    {/* Row 2 */}
                    <div className="grid grid-cols-2 divide-x divide-white/[0.05] border-b border-white/[0.05]">
                        <div className="p-5">
                            <p className={LBL}>Tool Calls</p>
                            <p className={VAL}>{usage ? String(usage.totalToolCalls) : "—"}</p>
                            {usage?.totalToolCalls ? <p className="text-[11px] text-white/20 mt-1.5">{new Set(usage.sessions.map(s => s.agentName)).size} agents used</p> : null}
                        </div>
                        <div className="p-5">
                            <p className={LBL}>Avg Tokens / Msg</p>
                            <p className={VAL}>{usage ? fmt(avgTok) : "—"}</p>
                            {usage && <p className="text-[11px] text-white/20 mt-1.5">Across {usage.totalMessages} messages</p>}
                        </div>
                    </div>
                    {/* Row 3 */}
                    <div className="grid grid-cols-2 divide-x divide-white/[0.05] border-b border-white/[0.05]">
                        <div className="p-5">
                            <p className={LBL}>Cache Hit Rate</p>
                            <p className="text-[26px] font-bold leading-none tracking-tight" style={{ color: (usage?.cacheHitRate || 0) > 50 ? "#22c55e" : "#eab308" }}>
                                {usage ? `${usage.cacheHitRate.toFixed(1)}%` : "—"}
                            </p>
                            {usage && <p className="text-[11px] text-white/20 mt-1.5">{fmt(usage.costTotals.cacheRead)} cached · {fmt(usage.costTotals.input + usage.costTotals.cacheRead)} prompt</p>}
                        </div>
                        <div className="p-5">
                            <p className={LBL}>Error Rate</p>
                            <p className="text-[26px] font-bold leading-none tracking-tight" style={{
                                color: (usage?.errorRate || 0) > 5 ? "#ef4444" : (usage?.errorRate || 0) > 0 ? "#f97316" : "#22c55e"
                            }}>
                                {usage ? `${usage.errorRate.toFixed(2)}%` : "—"}
                            </p>
                            {usage && <p className="text-[11px] text-white/20 mt-1.5">{usage.totalErrors} errors · {usage.totalMessages} msgs</p>}
                        </div>
                    </div>
                    {/* Row 4 */}
                    <div className="grid grid-cols-3 divide-x divide-white/[0.05]">
                        <div className="p-5">
                            <p className={LBL}>Avg Cost / Msg</p>
                            <p className={VAL}>{usage?.avgCostPerMessage ? fmtCost(usage.avgCostPerMessage) : "—"}</p>
                            {usage && <p className="text-[11px] text-white/20 mt-1.5">{fmtCost(usage.totalCostUsd)} total</p>}
                        </div>
                        <div className="p-5">
                            <p className={LBL}>Sessions</p>
                            <p className={VAL}>{usage ? String(usage.sessionCount) : "—"}</p>
                            <p className="text-[11px] text-white/20 mt-1.5">of {usage?.sessionCount || 0} in range</p>
                        </div>
                        <div className="p-5">
                            <p className={LBL}>Errors</p>
                            <p className="text-[26px] font-bold leading-none tracking-tight" style={{ color: (usage?.totalErrors || 0) > 0 ? "#ef4444" : undefined }}>
                                {usage ? String(usage.totalErrors) : "—"}
                            </p>
                            {usage?.totalToolCalls ? <p className="text-[11px] text-white/20 mt-1.5">{usage.totalToolCalls} tool results</p> : null}
                        </div>
                    </div>
                </div>

                {/* Right: Rankings (4 quadrants) */}
                <div className="col-span-12 lg:col-span-7 grid grid-cols-2">
                    {/* Top Models */}
                    <div className="p-4 border-b border-r border-white/[0.05]">
                        <p className={`${LBL} mb-2`}>Top Models</p>
                        {topModels.length === 0 && <p className="text-[11px] text-white/15 italic">No data</p>}
                        {topModels.map((m, i) => (
                            <div key={i} className="flex items-center justify-between py-[5px] text-[11px]">
                                <span className="text-white/40 truncate max-w-[110px]">{m.model}</span>
                                <span className="text-right">
                                    <b className="text-white">{fmtCost(m.costUsd)}</b>
                                    <span className="text-white/15 ml-1.5">{fmt(m.totalTokens)} · {m.messageCount} msgs</span>
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Top Providers */}
                    <div className="p-4 border-b border-white/[0.05]">
                        <p className={`${LBL} mb-2`}>Top Providers</p>
                        {topProviders.length === 0 && <p className="text-[11px] text-white/15 italic">No data</p>}
                        {topProviders.map(([name, d], i) => (
                            <div key={i} className="flex items-center justify-between py-[5px] text-[11px]">
                                <span className="text-white/40 truncate max-w-[110px]">{name}</span>
                                <span className="text-right">
                                    <b className="text-white">{fmtCost(d.c)}</b>
                                    <span className="text-white/15 ml-1.5">{fmt(d.t)} · {d.n} msgs</span>
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Top Agents */}
                    <div className="p-4 border-r border-white/[0.05]">
                        <p className={`${LBL} mb-2`}>Top Agents</p>
                        {(usage?.agents || []).slice(0, 6).map((a, i) => (
                            <div key={i} className="flex items-center justify-between py-[5px] text-[11px]">
                                <span className="flex items-center gap-1.5 text-white/40">
                                    <span className="w-[5px] h-[5px] rounded-full" style={{ background: AGENT_CLR[a.id] || "#a78bfa" }} />
                                    {a.displayName.toLowerCase()}
                                </span>
                                <span className="text-right">
                                    <b className="text-white">{fmtCost(a.costUsd)}</b>
                                    <span className="text-white/15 ml-1.5">{fmt(a.totalTokens)}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Rate Limits */}
                    <div className="p-4">
                        <p className={`${LBL} mb-2`}>Rate Limits</p>
                        {(usage?.providers || []).map(p => (
                            <div key={p.provider} className="mb-3 last:mb-0">
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-white/30">{p.displayName} <span className="text-white/15">{p.plan}</span></span>
                                </div>
                                {p.windows.map(w => (
                                    <div key={w.label} className="mb-2 last:mb-0">
                                        <div className="flex justify-between text-[10px] mb-0.5">
                                            <span className="text-white/20">{w.label}</span>
                                            <span className={`font-bold ${w.usedPercent > 80 ? "text-red-400" : w.usedPercent > 50 ? "text-amber-400" : "text-emerald-400"}`}>
                                                {w.usedPercent}%
                                            </span>
                                        </div>
                                        <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                                            <div className={`h-full rounded-full ${w.usedPercent > 80 ? "bg-red-500" : w.usedPercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                style={{ width: `${Math.min(w.usedPercent, 100)}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {(!usage?.providers?.length) && <p className="text-[11px] text-white/15 italic">No limits</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══ Daily Chart ═════════════════════════════════════════════════════════ */

function DailyChart({ usage }: { usage: GatewayUsageData }) {
    const data = usage.dailyCosts.filter(d => d.totalTokens > 0);
    if (data.length === 0) return null;
    const max = Math.max(...data.map(d => d.totalTokens));

    return (
        <div className={BOX}>
            <div className="px-5 py-3 border-b border-white/[0.05] flex justify-between items-center">
                <h2 className="text-[13px] font-semibold text-white">Daily Token Usage</h2>
                <span className="text-[11px] text-white/20">{data.length} days</span>
            </div>
            <div className="px-5 py-4">
                <div className="flex items-end gap-[3px] h-28 mb-2">
                    {data.map((d) => {
                        const h = max > 0 ? (d.totalTokens / max) * 100 : 0;
                        const tot = d.input + d.output + d.cacheRead || 1;
                        const cachePct = (d.cacheRead / tot) * 100;
                        return (
                            <div key={d.date} className="flex-1 rounded-t-sm overflow-hidden flex flex-col justify-end cursor-default group relative"
                                style={{ height: `${Math.max(h, 3)}%` }}>
                                <div className="w-full" style={{ height: `${cachePct}%`, background: "rgba(96,165,250,0.6)" }} />
                                <div className="w-full flex-1" style={{ background: "rgba(52,211,153,0.6)" }} />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-neutral-800 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg border border-white/10">
                                    {d.date}: {fmt(d.totalTokens)} tokens · {fmtCost(d.totalCost)}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between text-[10px] text-white/15">
                    <span>{data[0]?.date}</span>
                    <span>{data[data.length - 1]?.date}</span>
                </div>
            </div>
        </div>
    );
}

/* ═══ Tokens by Type ══════════════════════════════════════════════════════ */

function TokensType({ usage }: { usage: GatewayUsageData }) {
    const t = usage.costTotals;
    const total = t.output + t.input + t.cacheWrite + t.cacheRead;
    if (total === 0) return null;

    const segs = [
        { label: "Output", value: t.output, color: "#ef4444" },
        { label: "Input", value: t.input, color: "#22c55e" },
        { label: "Cache Write", value: t.cacheWrite, color: "#eab308" },
        { label: "Cache Read", value: t.cacheRead, color: "#3b82f6" },
    ];

    return (
        <div className={BOX}>
            <div className="px-5 py-3 border-b border-white/[0.05] flex justify-between items-center">
                <h2 className="text-[13px] font-semibold text-white">Tokens by Type</h2>
                <span className="text-[11px] text-white/20">Total: {fmt(total)}</span>
            </div>
            <div className="px-5 py-4 space-y-3">
                <div className="h-[10px] rounded-sm overflow-hidden flex bg-white/[0.04]">
                    {segs.map(s => s.value > 0 ? (
                        <div key={s.label} className="h-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
                    ) : null)}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                    {segs.map(s => (
                        <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-white/35">
                            <span className="w-[7px] h-[7px] rounded-full" style={{ background: s.color }} />
                            {s.label} {fmt(s.value)}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ═══ Session Row ═════════════════════════════════════════════════════════ */

function SessionRow({ s }: { s: SessionInfo }) {
    const [copied, setCopied] = useState(false);
    const color = AGENT_CLR[s.agentName] || "#a78bfa";
    const copy = useCallback(() => {
        navigator.clipboard.writeText(s.key);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [s.key]);

    return (
        <div className="flex items-center justify-between py-3 px-5 border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors group">
            <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-white truncate">{s.label || s.displayName || s.key}</p>
                <p className="text-[10px] text-white/20 truncate mt-0.5">
                    {s.agentName} · {s.modelProvider} · {s.model}
                    {s.runtimeMs ? ` · ${fmtDur(s.runtimeMs)}` : ""}
                    {s.lastChannel ? ` · ${s.lastChannel}` : ""}
                </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <button onClick={copy} className="text-[10px] text-white/15 hover:text-white/40 transition opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                </button>
                <span className="text-[13px] font-bold tabular-nums min-w-[50px] text-right" style={{ color }}>{fmt(s.totalTokens)}</span>
            </div>
        </div>
    );
}

/* ═══ Sessions Panel ══════════════════════════════════════════════════════ */

function SessionsList({ usage }: { usage: GatewayUsageData | null }) {
    const [sortBy, setSortBy] = useState<"recent" | "tokens">("recent");
    const [open, setOpen] = useState(true);

    const sorted = useMemo(() => {
        if (!usage?.sessions) return [];
        const s = [...usage.sessions];
        return sortBy === "tokens" ? s.sort((a, b) => b.totalTokens - a.totalTokens) : s.sort((a, b) => b.updatedAt - a.updatedAt);
    }, [usage, sortBy]);

    return (
        <div className={BOX}>
            <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-[13px] font-semibold text-white hover:opacity-80 transition">
                        Sessions
                        <ChevronDown className={`w-3.5 h-3.5 text-white/25 transition-transform ${open ? "" : "-rotate-90"}`} />
                    </button>
                    {usage && <span className="text-[11px] text-white/20">{fmt(usage.totalTokens / Math.max(usage.sessionCount, 1))} avg · {usage.totalErrors} errors</span>}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/20 uppercase tracking-wider">Sort</span>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
                        className="text-[10px] bg-white/[0.03] border border-white/[0.06] rounded-md px-2 py-1 text-white/50 outline-none">
                        <option value="recent">Recent</option>
                        <option value="tokens">Tokens</option>
                    </select>
                    {usage && <span className="text-[11px] text-white/15">{usage.sessionCount} shown</span>}
                </div>
            </div>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                        {sorted.map(s => <SessionRow key={s.key} s={s} />)}
                        {sorted.length === 0 && <div className="py-8 text-center text-[11px] text-white/15">No sessions</div>}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ═══ Page ════════════════════════════════════════════════════════════════ */

export default function ObservabilityPage() {
    const { usage, isLoading, error, fetchUsage } = useUsageStore();
    const isConnected = useOpenClawStore((s) => s.isConnected);
    const [timeRange, setTimeRange] = useState<TimeRange>("30d");
    const [viewMode, setViewMode] = useState<ViewMode>("tokens");

    useEffect(() => { fetchUsage(); }, [fetchUsage, isConnected]);

    return (
        <div className="flex flex-col h-full text-white">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4">
                <h1 className="text-[16px] font-semibold">Usage</h1>
            </div>

            <ScrollArea className="flex-1 -mr-3 pr-3">
                <div className="space-y-3 pb-10">
                    {error && (
                        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-400">{error}</div>
                    )}

                    {/* Filter Bar */}
                    <FilterBar
                        timeRange={timeRange} setTimeRange={setTimeRange}
                        viewMode={viewMode} setViewMode={setViewMode}
                        onRefresh={fetchUsage} isLoading={isLoading}
                        isConnected={isConnected} usage={usage}
                    />

                    {/* Usage Overview — single panel, metrics left + rankings right */}
                    <UsageOverview usage={usage} viewMode={viewMode} />

                    {/* Charts row */}
                    {usage && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <DailyChart usage={usage} />
                            <TokensType usage={usage} />
                        </div>
                    )}

                    {/* Sessions */}
                    <SessionsList usage={usage} />

                    {/* Footer */}
                    <p className="text-[10px] text-white/10 px-1 leading-relaxed">
                        All data from OpenClaw Gateway — usage.status, usage.cost, sessions.list RPC.
                    </p>
                </div>
            </ScrollArea>
        </div>
    );
}
