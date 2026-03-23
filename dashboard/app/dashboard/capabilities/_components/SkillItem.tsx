'use client';

import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { useState } from 'react';

interface SkillItemProps {
    skillKey: string;
    name: string;
    description?: string;
    enabled: boolean;
    eligible: boolean;
    missingRequirements?: string[];
    inherited?: boolean;
    isToggling?: boolean;
    onToggle: (enabled: boolean) => void;
}

export function SkillItem({ name, description, enabled, eligible, missingRequirements, inherited, isToggling, onToggle }: SkillItemProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className={cn(
            'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors',
            'hover:bg-white/[0.03]',
            inherited && 'opacity-60',
        )}>
            {/* Eligibility Dot + Name */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {/* Eligibility dot */}
                    <div className={cn(
                        'shrink-0 size-2 rounded-full',
                        eligible
                            ? 'bg-emerald-400/80'
                            : 'bg-amber-400/80'
                    )} />
                    <span className="text-sm font-mono text-white/80 truncate">
                        {name}
                    </span>
                    {inherited && (
                        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-white/25 bg-white/5 px-1.5 py-0.5 rounded-md">
                            inherited
                        </span>
                    )}
                    {!eligible && missingRequirements && missingRequirements.length > 0 && (
                        <div className="relative">
                            <button
                                onMouseEnter={() => setShowTooltip(true)}
                                onMouseLeave={() => setShowTooltip(false)}
                                className="shrink-0"
                            >
                                <Info className="size-3 text-amber-400/50 hover:text-amber-400/80 transition-colors" />
                            </button>
                            {showTooltip && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 p-2.5 rounded-lg
                                    bg-[#0a0a0a] border border-amber-500/20 shadow-xl">
                                    <p className="text-[10px] uppercase tracking-wider text-amber-400/70 font-mono mb-1">
                                        Missing Requirements
                                    </p>
                                    <ul className="text-xs font-mono text-white/50 space-y-0.5">
                                        {missingRequirements.map((req, i) => (
                                            <li key={i} className="flex items-center gap-1.5">
                                                <span className="text-amber-400/50">·</span>
                                                {req}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {description && (
                    <p className="mt-0.5 text-xs font-mono text-white/30 truncate pl-4">
                        {description}
                    </p>
                )}
            </div>

            {/* Toggle Switch */}
            <button
                onClick={() => onToggle(!enabled)}
                disabled={isToggling}
                title={!eligible ? 'Skill requirements not met' : undefined}
                className={cn(
                    'relative shrink-0 w-9 h-5 rounded-full transition-all duration-200',
                    isToggling && 'opacity-40 cursor-not-allowed',
                    enabled
                        ? 'bg-emerald-500/30 border border-emerald-500/40'
                        : 'bg-white/5 border border-white/10'
                )}
            >
                <div className={cn(
                    'absolute top-0.5 size-4 rounded-full transition-all duration-200',
                    enabled
                        ? 'left-[18px] bg-emerald-400'
                        : 'left-0.5 bg-white/30'
                )} />
            </button>
        </div>
    );
}
