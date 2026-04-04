'use client';

import { useState, useMemo } from 'react';
import { Search, Wrench } from 'lucide-react';
import { ToolItem } from './ToolItem';
import type { OpenClawTool } from '@/lib/openclaw/capabilities';

interface ToolsColumnProps {
    tools: OpenClawTool[];
    togglingItems: Set<string>;
    onToggle: (toolName: string, allowed: boolean) => void;
}

export function ToolsColumn({ tools, togglingItems, onToggle }: ToolsColumnProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return tools;
        const q = search.toLowerCase();
        return tools.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.group?.toLowerCase().includes(q) ||
            t.description?.toLowerCase().includes(q)
        );
    }, [tools, search]);

    // Group by group name for display
    const groups = useMemo(() => {
        const map = new Map<string, OpenClawTool[]>();
        for (const tool of filtered) {
            const group = tool.group || 'other';
            if (!map.has(group)) map.set(group, []);
            map.get(group)!.push(tool);
        }
        return map;
    }, [filtered]);

    const enabledCount = tools.filter(t => t.allowed).length;

    return (
        <div className="flex flex-col rounded-md border border-white/[0.06] bg-white/[0.02]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-orange-400/70" />
                    <h3 className="text-sm font-semibold text-white/90 tracking-wide">
                        Tools
                    </h3>
                    <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                        {enabledCount}/{tools.length}
                    </span>
                </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Search className="size-3.5 text-white/25" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Filter tools..."
                        className="flex-1 bg-transparent text-xs font-mono text-white/80 placeholder:text-white/20
                            outline-none border-none"
                    />
                </div>
            </div>

            {/* Tools List */}
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-360px)] scrollbar-thin">
                {filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                        <p className="text-xs font-mono text-white/30">
                            {search ? 'No tools match your search' : 'No tools available'}
                        </p>
                    </div>
                ) : (
                    <div className="p-2 space-y-3">
                        {Array.from(groups.entries()).map(([groupName, groupTools]) => (
                            <div key={groupName}>
                                <p className="px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-white/20">
                                    {groupName}
                                </p>
                                <div className="space-y-0.5">
                                    {groupTools.map(tool => (
                                        <ToolItem
                                            key={tool.name}
                                            {...tool}
                                            isToggling={togglingItems.has(`global-tool-${tool.name}`) || togglingItems.has(`agent-tool-${tool.name}`)}
                                            onToggle={(allowed) => onToggle(tool.name, allowed)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
