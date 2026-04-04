'use client';

import { useState, useMemo } from 'react';
import { Search, Sparkles, Maximize2 } from 'lucide-react';
import { SkillItem } from './SkillItem';
import type { OpenClawSkill } from '@/lib/openclaw/capabilities';

interface SkillsColumnProps {
    skills: OpenClawSkill[];
    togglingItems: Set<string>;
    onToggle: (skillKey: string, enabled: boolean) => void;
    onExpand?: () => void;
}

export function SkillsColumn({ skills, togglingItems, onToggle, onExpand }: SkillsColumnProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return skills;
        const q = search.toLowerCase();
        return skills.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.key.toLowerCase().includes(q) ||
            s.description?.toLowerCase().includes(q)
        );
    }, [skills, search]);

    const enabledCount = skills.filter(s => s.enabled).length;
    const eligibleCount = skills.filter(s => s.eligible).length;

    return (
        <div className="flex flex-col rounded-md border border-white/[0.06] bg-white/[0.02]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-violet-400/70" />
                    <h3 className="text-sm font-semibold text-white/90 tracking-wide">
                        Skills
                    </h3>
                    <span className="text-[10px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                        {enabledCount}/{skills.length}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400/40 bg-emerald-500/5 px-2 py-0.5 rounded-full">
                        {eligibleCount} eligible
                    </span>
                </div>
                {onExpand && (
                    <button
                        onClick={onExpand}
                        className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-all"
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
                            {search ? 'No skills match your search' : 'No skills configured on this Gateway'}
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
