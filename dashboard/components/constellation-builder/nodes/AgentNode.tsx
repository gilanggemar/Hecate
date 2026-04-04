'use client';

// nodes/AgentNode.tsx
// Rich visual ReactFlow node for each OpenClaw agent.
// Shows: identity, mission excerpt, scope tags, boundary zones, file inventory, build score.

import { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FileText, Shield, BookOpen, Brain, Zap } from 'lucide-react';
import type { AgentArchitecture, BuildScore } from '@/lib/constellation/agentSchema';

export interface AgentNodeData {
    agent: AgentArchitecture;
    isSelected: boolean;
    onOpenDrawer: (agentId: string) => void;
}

const BUILD_LABELS: { key: keyof BuildScore; label: string; short: string }[] = [
    { key: 'roleClarity', label: 'Role', short: 'R' },
    { key: 'doctrineDepth', label: 'Doctrine', short: 'D' },
    { key: 'operationalization', label: 'Ops', short: 'O' },
    { key: 'proceduralCapability', label: 'Skills', short: 'S' },
    { key: 'memoryMaturity', label: 'Memory', short: 'M' },
    { key: 'characterDistinctness', label: 'Character', short: 'C' },
    { key: 'handoffIntegrity', label: 'Handoff', short: 'H' },
];

// Map file names to icons and labels for the file inventory
const FILE_META: Record<string, { icon: typeof FileText; label: string; category: string }> = {
    'SOUL.md': { icon: Brain, label: 'Soul', category: 'Character' },
    'AGENTS.md': { icon: Shield, label: 'Protocol', category: 'Operations' },
    'IDENTITY.md': { icon: Zap, label: 'Identity', category: 'Identity' },
    'USER.md': { icon: Zap, label: 'User', category: 'Context' },
    'TOOLS.md': { icon: Zap, label: 'Tools', category: 'Capabilities' },
    'MEMORY.md': { icon: BookOpen, label: 'Memory', category: 'Persistence' },
    'HEARTBEAT.md': { icon: Zap, label: 'Heartbeat', category: 'Autonomy' },
};

function truncate(s: string, maxLen: number): string {
    if (!s) return '';
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen).trim() + '…';
}

function AgentNodeComponent({ data }: NodeProps & { data: AgentNodeData }) {
    const { agent, isSelected, onOpenDrawer } = data;

    const totalScore = useMemo(() => {
        const vals = Object.values(agent.buildScore);
        const sum = vals.reduce((a, b) => a + b, 0);
        return Math.round((sum / (vals.length * 5)) * 100);
    }, [agent.buildScore]);

    const missionExcerpt = truncate(agent.roleCharter.mission, 80);
    const hasMission = agent.roleCharter.mission.trim().length > 0;
    const fileCount = agent.files.length;
    const mdFiles = agent.files.filter(f => f.name.endsWith('.md'));
    const dirtyCount = agent.files.filter(f => f.isDirty).length;
    const ownsCount = agent.boundaries.owns.length;
    const staysOutCount = agent.boundaries.staysOutOf.length;

    return (
        <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="group cursor-pointer select-none"
            onClick={() => onOpenDrawer(agent.id)}
            style={{ width: 280 }}
        >
            {/* Connection handles */}
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-3 !h-3" />
            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-3 !h-3" />
            <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-3 !h-3" />
            <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-3 !h-3" />

            {/* Outer glow */}
            <div
                className="absolute -inset-1.5 rounded-lg opacity-20 blur-lg transition-opacity duration-700 group-hover:opacity-50"
                style={{ background: agent.colorHex }}
            />

            {/* Card */}
            <div
                className="relative rounded-lg border backdrop-blur-xl overflow-hidden transition-all duration-300"
                style={{
                    background: 'rgba(10, 10, 14, 0.92)',
                    borderColor: isSelected ? agent.colorHex : `${agent.colorHex}25`,
                    boxShadow: isSelected
                        ? `0 0 30px ${agent.colorHex}30, inset 0 1px 0 rgba(255,255,255,0.04)`
                        : `inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}
            >
                {/* Header stripe */}
                <div
                    className="h-[3px] w-full"
                    style={{ background: `linear-gradient(90deg, ${agent.colorHex}, ${agent.colorHex}40, transparent)` }}
                />

                <div className="p-4 space-y-3">
                    {/* ── Identity Row ── */}
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[15px] font-bold tracking-wide" style={{ color: agent.colorHex }}>
                                    {agent.name}
                                </span>
                                <span className="text-[8px] font-mono font-bold tracking-[0.2em] px-1.5 py-0.5 rounded-sm bg-white/5 text-white/35">
                                    {agent.codename}
                                </span>
                            </div>
                            <div className="text-[10px] font-mono text-white/30 mt-0.5">
                                {agent.executiveRole}
                            </div>
                        </div>

                        {/* Build score ring */}
                        <div className="relative flex items-center justify-center flex-shrink-0">
                            <svg width="40" height="40" viewBox="0 0 40 40">
                                <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
                                <circle
                                    cx="20" cy="20" r="16"
                                    fill="none"
                                    stroke={agent.colorHex}
                                    strokeWidth="3"
                                    strokeDasharray={`${totalScore * 1.005} 100.5`}
                                    strokeLinecap="round"
                                    transform="rotate(-90 20 20)"
                                    className="transition-all duration-700"
                                    style={{ opacity: 0.65 }}
                                />
                            </svg>
                            <span className="absolute text-[10px] font-mono font-bold text-white/60">
                                {totalScore}
                            </span>
                        </div>
                    </div>

                    {/* ── Mission Excerpt ── */}
                    {hasMission ? (
                        <div className="px-2 py-1.5 rounded-sm bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-[10px] font-mono text-white/50 leading-relaxed italic">
                                "{missionExcerpt}"
                            </p>
                        </div>
                    ) : (
                        <div className="px-2 py-1.5 rounded-sm border border-dashed border-white/8">
                            <p className="text-[10px] font-mono text-white/20 text-center">
                                No mission defined — click to configure
                            </p>
                        </div>
                    )}

                    {/* ── Scope & Boundaries ── */}
                    <div className="flex gap-2">
                        {/* Owns */}
                        <div className="flex-1 space-y-1">
                            <div className="text-[8px] font-mono text-white/20 uppercase tracking-wider">Owns</div>
                            <div className="flex flex-wrap gap-0.5">
                                {agent.boundaries.owns.length > 0 ? (
                                    agent.boundaries.owns.slice(0, 3).map((item, i) => (
                                        <span
                                            key={i}
                                            className="text-[8px] font-mono px-1 py-0.5 rounded-sm border truncate max-w-[100px]"
                                            style={{
                                                color: `${agent.colorHex}cc`,
                                                borderColor: `${agent.colorHex}20`,
                                                background: `${agent.colorHex}08`,
                                            }}
                                        >
                                            {item}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[8px] font-mono text-white/15">—</span>
                                )}
                                {ownsCount > 3 && (
                                    <span className="text-[8px] font-mono text-white/20">+{ownsCount - 3}</span>
                                )}
                            </div>
                        </div>

                        {/* Stays Out */}
                        <div className="flex-1 space-y-1">
                            <div className="text-[8px] font-mono text-white/20 uppercase tracking-wider">No-Fly</div>
                            <div className="flex flex-wrap gap-0.5">
                                {agent.boundaries.staysOutOf.length > 0 ? (
                                    agent.boundaries.staysOutOf.slice(0, 2).map((item, i) => (
                                        <span
                                            key={i}
                                            className="text-[8px] font-mono px-1 py-0.5 rounded-sm border border-red-500/15 bg-red-500/5 text-red-400/50 truncate max-w-[80px]"
                                        >
                                            {item}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[8px] font-mono text-white/15">—</span>
                                )}
                                {staysOutCount > 2 && (
                                    <span className="text-[8px] font-mono text-white/20">+{staysOutCount - 2}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Build Score Bars ── */}
                    <div className="space-y-0.5">
                        <div className="text-[8px] font-mono text-white/20 uppercase tracking-wider mb-1">Build Stack</div>
                        <div className="grid grid-cols-7 gap-1">
                            {BUILD_LABELS.map(({ key, label, short }) => {
                                const val = agent.buildScore[key];
                                return (
                                    <div key={key} className="flex flex-col items-center gap-0.5" title={`${label}: ${val}/5`}>
                                        <div className="w-full h-[6px] rounded-sm bg-white/[0.04] overflow-hidden">
                                            <div
                                                className="h-full rounded-sm transition-all duration-700"
                                                style={{
                                                    width: `${(val / 5) * 100}%`,
                                                    background: val >= 3 ? agent.colorHex : val > 0 ? `${agent.colorHex}80` : 'transparent',
                                                    opacity: val > 0 ? 0.7 : 0,
                                                }}
                                            />
                                        </div>
                                        <span className="text-[7px] font-mono text-white/20">{short}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── File Inventory ── */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                        <div className="flex items-center gap-1 flex-wrap">
                            {mdFiles.slice(0, 6).map(f => {
                                const meta = FILE_META[f.name];
                                const hasContent = f.content.trim().length > 0;
                                return (
                                    <div
                                        key={f.name}
                                        className="flex items-center gap-0.5 px-1 py-0.5 rounded-sm text-[7px] font-mono"
                                        style={{
                                            background: hasContent ? `${agent.colorHex}08` : 'rgba(255,255,255,0.02)',
                                            color: hasContent ? `${agent.colorHex}90` : 'rgba(255,255,255,0.15)',
                                            border: `1px solid ${hasContent ? `${agent.colorHex}15` : 'rgba(255,255,255,0.04)'}`,
                                        }}
                                        title={f.name}
                                    >
                                        {f.name.replace('.md', '')}
                                    </div>
                                );
                            })}
                            {mdFiles.length > 6 && (
                                <span className="text-[7px] font-mono text-white/20">
                                    +{mdFiles.length - 6}
                                </span>
                            )}
                        </div>

                        {dirtyCount > 0 && (
                            <span className="text-[8px] font-mono text-amber-400/60 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse" />
                                {dirtyCount} unsaved
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export const AgentNode = memo(AgentNodeComponent);
