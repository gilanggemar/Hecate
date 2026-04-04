'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Repeat, Check, X, Flame, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaskCardProps {
    id: string;
    title: string;
    agentId: string;
    agentName: string;
    agentColor: string;
    scheduledTime?: string | null;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'PENDING';
    recurrenceType?: string;
    description?: string | null;
    isCompact?: boolean;
    isDragging?: boolean;
    onClick?: () => void;
}

// ─── Priority dot colors ────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
    low: 'var(--accent-lime)',
    medium: 'var(--accent-ocean)',
    high: 'var(--status-warning)',
    critical: 'var(--status-error)',
    LOW: 'var(--accent-lime)',
    MEDIUM: 'var(--accent-ocean)',
    HIGH: 'var(--status-warning)',
    CRITICAL: 'var(--status-error)',
};

// ─── Recurrence label helper ────────────────────────────────────────────────

function getRecurrenceLabel(type?: string): string {
    switch (type) {
        case 'hourly': return 'Hourly';
        case 'daily': return 'Daily';
        case 'weekly': return 'Weekly';
        case 'monthly': return 'Monthly';
        case 'custom': return 'Custom';
        default: return '';
    }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TaskCard({
    title, agentName, agentColor, scheduledTime, priority,
    status, recurrenceType, description, isCompact = false,
    isDragging = false, onClick,
}: TaskCardProps) {
    const priorityColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
    const isRecurring = recurrenceType && recurrenceType !== 'none';

    return (
        <motion.div
            onClick={onClick}
            whileHover={!isDragging ? { scale: 1.02 } : undefined}
            className={cn(
                'nerv-glass-1 transition-all duration-150 cursor-grab active:cursor-grabbing select-none',
                isCompact
                    ? 'rounded-lg p-2 mb-1.5 border-l-4'
                    : 'rounded-md p-3 mb-2 border-l-4',
                isDragging && 'opacity-50 border-dashed',
            )}
            style={{ borderLeftColor: agentColor }}
        >
            {/* ─── Compact mode (calendar column) ─── */}
            {isCompact ? (
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                        <span className="nerv-body-sm font-medium truncate flex-1">
                            {title}
                        </span>
                        {/* Status indicator */}
                        {status === 'running' && (
                            <span className="w-2 h-2 rounded-full bg-[var(--status-online)] animate-pulse shrink-0" />
                        )}
                        {status === 'completed' && (
                            <Check className="w-3 h-3 shrink-0" style={{ color: 'var(--status-online)' }} />
                        )}
                        {status === 'failed' && (
                            <X className="w-3 h-3 shrink-0" style={{ color: 'var(--status-error)' }} />
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="nerv-caption truncate">{agentName}</span>
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: priorityColor }}
                        />
                    </div>
                    {scheduledTime && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5 opacity-40" />
                            <span className="nerv-mono-sm opacity-60">{scheduledTime}</span>
                        </div>
                    )}
                    {isRecurring && (
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Repeat className="w-3 h-3 opacity-40 mt-0.5" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="nerv-glass-3">
                                    {getRecurrenceLabel(recurrenceType)}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            ) : (
                /* ─── Full mode (tray) ─── */
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                        <span className="nerv-body font-medium line-clamp-2 flex-1">
                            {title}
                        </span>
                        {status === 'running' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-online)] animate-pulse shrink-0 mt-1" />
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        <div
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{ backgroundColor: agentColor }}
                        />
                        <span className="nerv-body-sm opacity-70">{agentName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: priorityColor }}
                        />
                        <span className="nerv-caption capitalize">{priority}</span>
                        {isRecurring && (
                            <span className="flex items-center gap-0.5 nerv-caption">
                                <Repeat className="w-3 h-3 opacity-50" />
                                {getRecurrenceLabel(recurrenceType)}
                            </span>
                        )}
                    </div>

                    {description && (
                        <p className="nerv-caption truncate mt-0.5">{description}</p>
                    )}
                </div>
            )}
        </motion.div>
    );
}
