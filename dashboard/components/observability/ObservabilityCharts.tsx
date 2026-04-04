"use client";

import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, DollarSign, Clock } from "lucide-react";

interface ObservabilityChartsProps {
    chartData: any[] | null | undefined;
    costByAgentData: { agent: string; cost: number }[];
    latencyData: { provider: string; latency: number }[];
}

export default function ObservabilityCharts({ chartData: rawChartData, costByAgentData, latencyData }: ObservabilityChartsProps) {
    // Ensure chartData is always an array (recharts internally calls .slice() on data)
    const chartData = Array.isArray(rawChartData) ? rawChartData : [];

    return (
        <>
            {/* ─── Token Consumption Chart ─── */}
            <section className="space-y-3">
                <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" /> Token Consumption
                </h2>
                <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
                    <CardContent className="p-4">
                        {chartData.length === 0 ? (
                            <div className="h-48 flex items-center justify-center text-muted-foreground/50 text-xs">
                                No telemetry data yet
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="oklch(0.70 0.10 70)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="oklch(0.70 0.10 70)" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="oklch(0.65 0.10 160)" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="oklch(0.65 0.10 160)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.008 50)" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 60)' }}
                                        tickFormatter={(v) => v.slice(11, 16)}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 60)' }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'oklch(0.155 0.006 50)',
                                            border: '1px solid oklch(0.24 0.008 50)',
                                            borderRadius: '12px',
                                            fontSize: '11px',
                                        }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="inputTokens"
                                        stroke="oklch(0.70 0.10 70)"
                                        fill="url(#inputGrad)"
                                        name="Input Tokens"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="outputTokens"
                                        stroke="oklch(0.65 0.10 160)"
                                        fill="url(#outputGrad)"
                                        name="Output Tokens"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </section>

            {/* ─── Cost & Latency Charts ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cost per Agent */}
                <section className="space-y-3">
                    <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5" /> Cost per Agent
                    </h2>
                    <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
                        <CardContent className="p-4">
                            {costByAgentData.length === 0 ? (
                                <div className="h-40 flex items-center justify-center text-muted-foreground/50 text-xs">
                                    No cost data yet
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={costByAgentData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.008 50)" />
                                        <XAxis
                                            dataKey="agent"
                                            tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 60)' }}
                                            axisLine={false} tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 60)' }}
                                            axisLine={false} tickLine={false}
                                            tickFormatter={(v) => `$${v}`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'oklch(0.155 0.006 50)',
                                                border: '1px solid oklch(0.24 0.008 50)',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                            }}
                                            formatter={(v) => [`$${Number(v).toFixed(4)}`, 'Cost']}
                                        />
                                        <Bar dataKey="cost" fill="oklch(0.70 0.10 70)" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </section>

                {/* Latency per Provider */}
                <section className="space-y-3">
                    <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" /> Avg Latency per Provider
                    </h2>
                    <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
                        <CardContent className="p-4">
                            {latencyData.length === 0 ? (
                                <div className="h-40 flex items-center justify-center text-muted-foreground/50 text-xs">
                                    No latency data yet
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={latencyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.24 0.008 50)" />
                                        <XAxis
                                            dataKey="provider"
                                            tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 60)' }}
                                            axisLine={false} tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 10, fill: 'oklch(0.55 0.01 60)' }}
                                            axisLine={false} tickLine={false}
                                            tickFormatter={(v) => `${v}ms`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: 'oklch(0.155 0.006 50)',
                                                border: '1px solid oklch(0.24 0.008 50)',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                            }}
                                            formatter={(v) => [`${v}ms`, 'Latency']}
                                        />
                                        <Bar dataKey="latency" fill="oklch(0.65 0.10 160)" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </section>
            </div>
        </>
    );
}
