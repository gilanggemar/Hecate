'use client';

import { cn } from '@/lib/utils';
import { TOOL_GROUP_COLORS } from '@/lib/openclaw/capabilities';

interface ToolItemProps {
    name: string;
    group?: string;
    description?: string;
    allowed: boolean;
    inherited?: boolean;
    isToggling?: boolean;
    onToggle: (allowed: boolean) => void;
}

export function ToolItem({ name, group, description, allowed, inherited, isToggling, onToggle }: ToolItemProps) {
    const groupColor = group ? (TOOL_GROUP_COLORS[group] || '#71717a') : '#71717a';

    return (
        <div className={cn(
            'group flex items-center gap-3 px-3.5 py-2.5 rounded-md transition-colors',
            'hover:bg-white/[0.03] border border-transparent',
            inherited && 'opacity-60',
        )}>
            {/* Name + Group Badge */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white/80 truncate">
                        {name}
                    </span>
                    {group && (
                        <span
                            className="shrink-0 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                            style={{
                                background: `${groupColor}15`,
                                color: groupColor,
                                border: `1px solid ${groupColor}25`,
                            }}
                        >
                            {group}
                        </span>
                    )}
                    {inherited && (
                        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-white/25 bg-white/5 px-1.5 py-0.5 rounded-md">
                            inherited
                        </span>
                    )}
                </div>
                {description && (
                    <p className="mt-0.5 text-xs font-mono text-white/30 truncate">
                        {description}
                    </p>
                )}
            </div>

            {/* Toggle Switch */}
            <button
                onClick={() => onToggle(!allowed)}
                disabled={isToggling}
                className={cn(
                    'relative shrink-0 w-9 h-5 rounded-full transition-all duration-200',
                    isToggling && 'opacity-50 cursor-wait',
                    allowed
                        ? 'bg-emerald-500/30 border border-emerald-500/40'
                        : 'bg-white/5 border border-white/10'
                )}
            >
                <div className={cn(
                    'absolute top-0.5 size-4 rounded-full transition-all duration-200',
                    allowed
                        ? 'left-[18px] bg-emerald-400'
                        : 'left-0.5 bg-white/30'
                )} />
            </button>
        </div>
    );
}
