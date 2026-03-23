'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Wrench } from 'lucide-react';
import { useOpenClawCapabilitiesStore } from '@/stores/useOpenClawCapabilitiesStore';
import { useRouter } from 'next/navigation';
import type { AgentProfile } from '@/lib/agentRoster';
import type { DynamicColors } from '@/hooks/useImageDominantColor';

interface AgentCapabilitiesProps {
    agent: AgentProfile;
    dynamicColors?: DynamicColors;
}

export function AgentCapabilities({ agent, dynamicColors }: AgentCapabilitiesProps) {
    const router = useRouter();
    const {
        globalTools, globalSkills, perAgentTools, perAgentSkills,
        fetchAll, isLoading, setActiveTab, setSelectedAgentId
    } = useOpenClawCapabilitiesStore();

    const [telemetry, setTelemetry] = useState<{ successRate: number } | null>(null);

    useEffect(() => {
        if (globalTools.length === 0 && !isLoading) {
            fetchAll();
        }
    }, [globalTools.length, isLoading, fetchAll]);

    useEffect(() => {
        fetch(`/api/telemetry?agentId=${agent.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) setTelemetry({ successRate: data.successRate ?? 0 });
            })
            .catch(() => setTelemetry(null));
    }, [agent.id]);

    const tools = useMemo(() => {
        const perAgent = perAgentTools[agent.id];
        return perAgent?.length ? perAgent : globalTools;
    }, [agent.id, perAgentTools, globalTools]);

    const skills = useMemo(() => {
        const perAgent = perAgentSkills[agent.id];
        return perAgent?.length ? perAgent : globalSkills;
    }, [agent.id, perAgentSkills, globalSkills]);

    const enabledTools = tools.filter(t => t.allowed).length;
    const enabledSkills = skills.filter(s => s.enabled).length;
    
    const successRate = telemetry ? telemetry.successRate.toFixed(1) : '0.0';

    const handleNavigateToCapabilities = () => {
        setActiveTab('per-agent');
        setSelectedAgentId(agent.id);
        router.push('/dashboard/capabilities');
    };

    const bg = dynamicColors?.containerBg || 'rgba(0,0,0,0.8)';
    const bgHover = dynamicColors?.containerBgHover || 'rgba(17,17,17,1)';
    const border = dynamicColors?.containerBorder || 'rgba(255,255,255,0.1)';
    const borderHover = dynamicColors?.containerBorderHover || 'rgba(255,255,255,0.2)';
    const shadow = dynamicColors?.containerShadow || '0 4px 12px rgba(0,0,0,0.5)';

    return (
        <div className="flex flex-col gap-3 font-mono w-full">
            <button 
                onClick={handleNavigateToCapabilities}
                className="flex items-center gap-4 border rounded-md p-3.5 transition-all duration-500 text-left w-full focus:outline-none focus:ring-1 focus:ring-white/20 active:scale-[0.99] cursor-pointer"
                style={{ background: bg, borderColor: border, boxShadow: shadow }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = bgHover;
                    e.currentTarget.style.borderColor = borderHover;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = bg;
                    e.currentTarget.style.borderColor = border;
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <div className="w-10 flex items-center justify-center flex-shrink-0">
                    <Wrench size={22} style={{ color: agent.colorHex }} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mb-1">
                        Tools Enabled
                    </span>
                    <span className="text-2xl font-black leading-none text-white tracking-wider">
                        {enabledTools}
                    </span>
                </div>
            </button>

            <button 
                onClick={handleNavigateToCapabilities}
                className="flex items-center gap-4 border rounded-md p-3.5 transition-all duration-500 text-left w-full focus:outline-none focus:ring-1 focus:ring-white/20 active:scale-[0.99] cursor-pointer"
                style={{ background: bg, borderColor: border, boxShadow: shadow }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = bgHover;
                    e.currentTarget.style.borderColor = borderHover;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = bg;
                    e.currentTarget.style.borderColor = border;
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <div className="w-10 flex items-center justify-center flex-shrink-0">
                    <Sparkles size={22} className="text-[#A259FF]" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 mb-1">
                        Skills Enabled
                    </span>
                    <span className="text-2xl font-black leading-none text-white tracking-wider">
                        {enabledSkills}
                    </span>
                </div>
            </button>

            {/* Success Rate */}
            <div
                className="mt-2 border rounded-md p-4 transition-all duration-500"
                style={{ background: bg, borderColor: border, boxShadow: shadow }}
            >
                <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40">
                        Success Rate
                    </span>
                    <span className="text-[10px] font-mono font-bold text-white/60">
                        {successRate}%
                    </span>
                </div>
                <div className="w-full h-[3px] bg-black rounded-full overflow-hidden border border-white/5">
                    <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ 
                            width: `${successRate}%`, 
                            backgroundColor: agent.colorHex, 
                            boxShadow: `0 0 10px ${agent.colorHex}80` 
                        }} 
                    />
                </div>
            </div>
        </div>
    );
}
