"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
    DollarSign, TrendingUp, Zap, Clock, AlertTriangle,
    BarChart3, Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTelemetryStore } from "@/store/useTelemetryStore";
import { formatCost } from "@/lib/telemetry/costs";

// Lazy-load the charts section (recharts is ~180KB gzipped)
const ObservabilityCharts = dynamic(
    () => import("@/components/observability/ObservabilityCharts"),
    {
        ssr: false,
        loading: () => <div className="h-64 w-full rounded-md bg-muted animate-pulse" />,
    }
);

export default function ObservabilityPage() {
    const { summary, chartData, isLoading, fetchAll } = useTelemetryStore();
    const [range, setRange] = useState("24h");

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const costByAgentData = summary?.costByAgent
        ? Object.entries(summary.costByAgent).map(([agent, cost]) => ({
            agent: agent.charAt(0).toUpperCase() + agent.slice(1),
            cost,
        }))
        : [];

    const latencyData = summary?.latencyByProvider
        ? Object.entries(summary.latencyByProvider).map(([provider, ms]) => ({
            provider,
            latency: ms,
        }))
        : [];

    const errorData = summary?.errorRateByAgent
        ? Object.entries(summary.errorRateByAgent).map(([agent, rate]) => ({
            agent: agent.charAt(0).toUpperCase() + agent.slice(1),
            rate,
        }))
        : [];

    return (
        <div className="flex flex-col h-full gap-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Observability</h1>
                <Select value={range} onValueChange={setRange}>
                    <SelectTrigger className="h-8 w-28 text-[12px] rounded-md border-border bg-background">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                        <SelectItem value="24h" className="text-xs rounded-lg">Last 24h</SelectItem>
                        <SelectItem value="7d" className="text-xs rounded-lg">Last 7 days</SelectItem>
                        <SelectItem value="30d" className="text-xs rounded-lg">Last 30 days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <ScrollArea className="flex-1">
                <div className="space-y-6 pb-6">

                    {/* ─── Spend Cards ─── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SpendCard
                            label="Today"
                            amount={summary?.totalSpendToday || 0}
                            icon={DollarSign}
                        />
                        <SpendCard
                            label="This Week"
                            amount={summary?.totalSpendWeek || 0}
                            icon={TrendingUp}
                        />
                        <SpendCard
                            label="This Month"
                            amount={summary?.totalSpendMonth || 0}
                            icon={BarChart3}
                        />
                    </div>

                    {/* ─── Charts (lazy-loaded) ─── */}
                    <ObservabilityCharts
                        chartData={chartData}
                        costByAgentData={costByAgentData}
                        latencyData={latencyData}
                    />

                    {/* ─── Error Rates ─── */}
                    <section className="space-y-3">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" /> Error Rate per Agent
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {errorData.length === 0 ? (
                                <Card className="col-span-full rounded-md border-dashed border-border bg-card/50 shadow-none">
                                    <CardContent className="p-6 text-center">
                                        <p className="text-xs text-muted-foreground/50">No error data yet</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                errorData.map((e) => (
                                    <motion.div key={e.agent} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                        <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
                                            <CardContent className="p-4 text-center">
                                                <p className="text-[11px] text-muted-foreground mb-1">{e.agent}</p>
                                                <p className={`text-lg font-semibold ${e.rate > 10 ? 'text-red-400' : e.rate > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {e.rate}%
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </section>

                </div>
            </ScrollArea>
        </div>
    );
}

/* ─── Spend Card ─── */
function SpendCard({ label, amount, icon: Icon }: { label: string; amount: number; icon: any }) {
    return (
        <Card className="relative p-5 rounded-md transition-all hover:border-foreground/20 group gap-0 shadow-none bg-card border-border">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
                    <p className="text-lg font-semibold text-foreground">{formatCost(amount)}</p>
                </div>
                <div className="w-9 h-9 flex items-center justify-center rounded-md bg-background border border-border text-muted-foreground">
                    <Icon className="w-4 h-4" />
                </div>
            </div>
        </Card>
    );
}
