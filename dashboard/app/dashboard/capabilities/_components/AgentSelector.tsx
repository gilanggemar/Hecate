'use client';

import { ChevronDown, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { OpenClawAgent } from '@/lib/openclaw/capabilities';
import { cn } from '@/lib/utils';

interface AgentSelectorProps {
    agents: OpenClawAgent[];
    selectedAgentId: string | null;
    onSelect: (agentId: string | null) => void;
}

export function AgentSelector({ agents, selectedAgentId, onSelect }: AgentSelectorProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selectedAgent = agents.find(a => a.id === selectedAgentId);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    if (agents.length === 0) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs font-mono text-white/40">No agents configured on this Gateway.</p>
            </div>
        );
    }

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between gap-3 w-full max-w-sm rounded-xl border border-white/10
                    bg-white/5 px-4 py-2.5 text-sm font-mono hover:bg-white/8 transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <User className="size-3.5 text-white/40" />
                    <span className={cn(
                        selectedAgent ? 'text-white/90' : 'text-white/40'
                    )}>
                        {selectedAgent
                            ? `${selectedAgent.name || selectedAgent.id}${selectedAgent.default ? ' (default)' : ''}`
                            : 'Select an agent to configure'
                        }
                    </span>
                </div>
                <ChevronDown className={cn(
                    'size-3.5 text-white/40 transition-transform',
                    open && 'rotate-180'
                )} />
            </button>

            {open && (
                <div className="absolute top-full left-0 z-50 mt-1 w-full max-w-sm rounded-xl border border-white/10
                    bg-[#0a0a0a] shadow-xl overflow-hidden">
                    {agents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => {
                                onSelect(agent.id);
                                setOpen(false);
                            }}
                            className={cn(
                                'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-mono text-left',
                                'hover:bg-white/5 transition-colors',
                                selectedAgentId === agent.id
                                    ? 'text-orange-400 bg-orange-500/5'
                                    : 'text-white/70'
                            )}
                        >
                            <User className="size-3.5 text-white/30" />
                            <span>{agent.name || agent.id}</span>
                            {agent.default && (
                                <span className="ml-auto text-[10px] uppercase tracking-wider text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                                    default
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
