'use client';

import { useState, useMemo } from 'react';
import { Search, Sparkles, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkillItem } from './SkillItem';
import type { OpenClawSkill } from '@/lib/openclaw/capabilities';

type SkillFilter = 'all' | 'shared' | 'local';

interface SkillsColumnProps {
    skills: OpenClawSkill[];
    togglingItems: Set<string>;
    onToggle: (skillKey: string, enabled: boolean) => void;
    onExpand?: () => void;
    isPerAgent?: boolean;
}

export function SkillsColumn({ skills, togglingItems, onToggle, onExpand, isPerAgent }: SkillsColumnProps) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<SkillFilter>('all');

    // Categorize skills
    const sharedSkills = useMemo(() => skills.filter(s => s.inherited), [skills]);
    const localSkills = useMemo(() => skills.filter(s => !s.inherited), [skills]);

    // Apply filter + search
    const filtered = useMemo(() => {
        let base = skills;
        if (isPerAgent) {
            if (filter === 'shared') base = sharedSkills;
            if (filter === 'local') base = localSkills;
        }

        if (!search.trim()) return base;
        const q = search.toLowerCase();
        return base.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.key.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q)
        );
    }, [skills, sharedSkills, localSkills, filter, search, isPerAgent]);

    const enabledCount = skills.filter(s => s.enabled).length;

    return (
        <div className="flex flex-col rounded-md border border-white/[0.06] bg-white/[0.02]">
            {/* Header — title, counts, filter tabs, expand */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Sparkles className="size-4 text-violet-400/70 shrink-0" />
                    <h3 className="text-sm font-semibold text-white/90 tracking-wide shrink-0">
                        Skills
                    </h3>
                    <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-full shrink-0">
                        {enabledCount}/{skills.length}
                    </span>

                    {/* Per-agent breakdown badges */}
                    {isPerAgent && (
                        <>
                            <span className="text-[10px] font-mono text-blue-400/40 bg-blue-500/5 px-2 py-0.5 rounded-full shrink-0">
                                {sharedSkills.length} shared
                            </span>
                            <span className="text-[10px] font-mono text-amber-400/50 bg-amber-500/8 px-2 py-0.5 rounded-full shrink-0">
                                {localSkills.length} local
                            </span>
                        </>
                    )}

                    {/* Filter toggle — always visible in per-agent */}
                    {isPerAgent && (
                        <div className="flex items-center rounded-md border border-white/[0.08] overflow-hidden shrink-0 ml-1">
                            {([
                                { id: 'all' as SkillFilter, label: 'All' },
                                { id: 'shared' as SkillFilter, label: 'Shared' },
                                { id: 'local' as SkillFilter, label: 'Local' },
                            ]).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id)}
                                    className={cn(
                                        'px-2 py-0.5 text-[10px] font-mono transition-all',
                                        filter === tab.id
                                            ? tab.id === 'local'
                                                ? 'bg-amber-500/15 text-amber-400/90 font-bold'
                                                : tab.id === 'shared'
                                                    ? 'bg-blue-500/10 text-blue-400/80 font-bold'
                                                    : 'bg-white/8 text-white/80 font-bold'
                                            : 'text-white/25 hover:text-white/50 hover:bg-white/3'
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {onExpand && (
                    <button
                        onClick={onExpand}
                        className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-all shrink-0"
                        title="Expand Skills Manager"
                    >
                        <Maximize2 className="size-3.5" />
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Search className="size-3.5 text-white/25" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Filter skills..."
                        className="flex-1 bg-transparent text-xs font-mono text-white/80 placeholder:text-white/20
                            outline-none border-none"
                    />
                </div>
            </div>

            {/* Skills List */}
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-360px)] scrollbar-thin">
                {filtered.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                        <p className="text-xs font-mono text-white/30">
                            {search
                                ? 'No skills match your search'
                                : filter === 'local'
                                    ? 'No agent-local skills found for this agent'
                                    : filter === 'shared'
                                        ? 'No shared skills available'
                                        : 'No skills configured on this Gateway'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="p-2 space-y-0.5">
                        {filtered.map(skill => (
                            <SkillItem
                                key={skill.key}
                                skillKey={skill.key}
                                name={skill.name}
                                description={skill.description}
                                enabled={skill.enabled}
                                eligible={skill.eligible}
                                missingRequirements={skill.missingRequirements}
                                inherited={skill.inherited}
                                source={skill.source}
                                isToggling={
                                    togglingItems.has(`global-skill-${skill.key}`) ||
                                    togglingItems.has(`agent-skill-${skill.key}`)
                                }
                                onToggle={(enabled) => onToggle(skill.key, enabled)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
