'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { AgentProfile } from '@/lib/agentRoster';
import type { DynamicColors } from '@/hooks/useImageDominantColor';

interface AgentStatBlockProps {
    agent: AgentProfile;
    level: number;
    dynamicColors?: DynamicColors;
}

interface TelemetryData {
    successRate: number;
    avgLatency: number;
    totalOps: number;
    totalTokens: number;
    monthlyCost: number;
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
}

export function AgentStatBlock({ agent, dynamicColors }: AgentStatBlockProps) {
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

    // Fetch telemetry for this agent
    useEffect(() => {
        fetch(`/api/telemetry?agentId=${agent.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setTelemetry({
                        successRate: data.successRate ?? 0,
                        avgLatency: data.avgLatency ?? 0,
                        totalOps: data.totalOps ?? 0,
                        totalTokens: data.totalTokens ?? 0,
                        monthlyCost: data.monthlyCost ?? 0,
                    });
                }
            })
            .catch(() => {
                setTelemetry({
                    successRate: 0,
                    avgLatency: 0,
                    totalOps: 0,
                    totalTokens: 0,
                    monthlyCost: 0,
                });
            });
    }, [agent.id]);

    const stats = telemetry || { successRate: 0, avgLatency: 0, totalOps: 0, totalTokens: 0, monthlyCost: 0 };

    return (
        <div className="flex flex-col space-y-1.5 pt-2">
            {/* Uplink */}
            <div className="flex justify-between items-center group py-2 border-b border-white/5 hover:border-white/20 transition-colors">
                <span className="text-[10px] uppercase font-mono font-bold tracking-[0.2em] text-white transition-colors">
                    UPLINK
                </span>
                <span className="text-[13px] font-mono font-bold text-white tracking-wider">
                    99.9%
                </span>
            </div>

            {/* Avg Latency */}
            <div className="flex justify-between items-center group py-2 border-b border-white/5 hover:border-white/20 transition-colors">
                <span className="text-[10px] uppercase font-mono font-bold tracking-[0.2em] text-white transition-colors">
                    AVG LATENCY
                </span>
                <span className="text-[13px] font-mono font-bold text-white tracking-wider">
                    {stats.avgLatency}ms
                </span>
            </div>

            {/* Tokens Used */}
            <div className="flex justify-between items-center group py-2 border-b border-white/5 hover:border-white/20 transition-colors">
                <span className="text-[10px] uppercase font-mono font-bold tracking-[0.2em] text-white transition-colors">
                    TOKENS USED
                </span>
                <span className="text-[13px] font-mono font-bold text-white tracking-wider">
                    {formatTokens(stats.totalTokens)}
                </span>
            </div>

            {/* Context Window */}
            <div className="flex justify-between items-center group py-2 border-b border-white/5 hover:border-white/20 transition-colors">
                <span className="text-[10px] uppercase font-mono font-bold tracking-[0.2em] text-white transition-colors">
                    CONTEXT WINDOW
                </span>
                <span className="text-[13px] font-mono font-bold text-white tracking-wider">
                    200K tokens
                </span>
            </div>
        </div>
    );
}
