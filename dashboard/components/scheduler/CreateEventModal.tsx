'use client';

import { useState, useMemo } from 'react';
import { Calendar, Clock, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSchedulerStore, type SchedulerEvent } from '@/store/useSchedulerStore';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';
import { useTaskStore } from '@/lib/useTaskStore';

// ─── Shared input/textarea style to match project panel ─────────────────────

const fieldStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 12,
    color: 'var(--popover-foreground)',
    fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--muted-foreground)',
    marginBottom: 3,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
};

// ─── Day-of-week toggle (reused) ────────────────────────────────────────────

const DAYS = [
    { value: 0, label: 'S' },
    { value: 1, label: 'M' },
    { value: 2, label: 'T' },
    { value: 3, label: 'W' },
    { value: 4, label: 'T' },
    { value: 5, label: 'F' },
    { value: 6, label: 'S' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateEventModal() {
    const {
        createModalOpen, createModalDate,
        setCreateModalOpen, createEvent,
    } = useSchedulerStore();
    const socketAgents = useAvailableAgents();
    const tasks = useTaskStore((s) => s.tasks);

    // Fallback agents when WebSocket hasn't connected yet
    const FALLBACK_AGENTS = useMemo(() => [
        { id: 'daisy', name: 'Daisy' },
        { id: 'ivy', name: 'Ivy' },
        { id: 'celia', name: 'Celia' },
        { id: 'thalia', name: 'Thalia' },
    ], []);
    const agentList = (socketAgents.length > 0 ? socketAgents : FALLBACK_AGENTS).filter((a: any) => a.id);
    const pendingTasks = useMemo(() =>
        tasks.filter(t => t.status === 'PENDING'),
        [tasks]);

    // Form state
    const [title, setTitle] = useState('');
    const [agentId, setAgentId] = useState('');
    const [description, setDescription] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [priority, setPriority] = useState('medium');
    const [linkedTaskId, setLinkedTaskId] = useState<string>('');
    const [recurrenceType, setRecurrenceType] = useState('none');
    const [recurrenceInterval, setRecurrenceInterval] = useState(1);
    const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([]);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

    // Pre-fill date when opened from column quick-add
    const effectiveDate = scheduledDate || createModalDate || format(new Date(), 'yyyy-MM-dd');

    // Auto-fill from linked task
    const handleTaskLink = (taskId: string) => {
        const realTaskId = taskId === '__none__' ? '' : taskId;
        setLinkedTaskId(realTaskId);
        if (realTaskId && tasks.find(t => t.id === realTaskId)) {
            const task = tasks.find(t => t.id === taskId)!;
            if (!title) setTitle(task.title);
            if (!agentId) setAgentId(task.agentId);
            if (task.description && !description) setDescription(task.description);
        }
    };

    const resetForm = () => {
        setTitle('');
        setAgentId('');
        setDescription('');
        setScheduledDate('');
        setScheduledTime('');
        setDurationMinutes(60);
        setPriority('medium');
        setLinkedTaskId('');
        setRecurrenceType('none');
        setRecurrenceInterval(1);
        setRecurrenceDaysOfWeek([]);
        setRecurrenceEndDate('');
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (!agentId) {
            toast.error('Agent is required');
            return;
        }

        await createEvent({
            title: title.trim(),
            agentId,
            description: description || null,
            scheduledDate: effectiveDate,
            scheduledTime: scheduledTime || null,
            durationMinutes,
            priority: priority as SchedulerEvent['priority'],
            taskId: linkedTaskId || null,
            recurrenceType: recurrenceType as SchedulerEvent['recurrenceType'],
            recurrenceInterval,
            recurrenceDaysOfWeek: recurrenceDaysOfWeek.length > 0 ? recurrenceDaysOfWeek : null,
            recurrenceEndDate: recurrenceEndDate || null,
        });

        toast.success('Event created');
        resetForm();
        setCreateModalOpen(false);
    };

    const recurrenceLabel = recurrenceType === 'hourly' ? 'hours'
        : recurrenceType === 'daily' ? 'days'
            : recurrenceType === 'weekly' ? 'weeks'
                : recurrenceType === 'monthly' ? 'months'
                    : '';

    return (
        <Dialog
            open={createModalOpen}
            onOpenChange={(open) => {
                if (!open) resetForm();
                setCreateModalOpen(open);
            }}
        >
            <DialogContent
                className="max-w-md gap-2 p-4"
                style={{
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                }}
            >
                <DialogHeader>
                    <DialogTitle style={{ fontSize: 16, fontWeight: 600 }}>Create Event</DialogTitle>
                </DialogHeader>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {/* Title */}
                    <div style={{ padding: '6px 0' }}>
                        <label style={labelStyle}>Title *</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Event title..."
                            style={{ ...fieldStyle, fontWeight: 500 }}
                            autoFocus
                        />
                    </div>

                    {/* Agent */}
                    <div style={{ padding: '6px 0' }}>
                        <label style={labelStyle}>Agent *</label>
                        <Select value={agentId} onValueChange={setAgentId}>
                            <SelectTrigger
                                className="shadow-none h-7 px-2.5 text-xs w-fit rounded-md"
                                style={{ color: 'var(--popover-foreground)', background: 'transparent', border: '1px solid var(--border)' }}
                            >
                                <SelectValue placeholder="Select agent..." />
                            </SelectTrigger>
                            <SelectContent className="text-xs" style={{ background: 'var(--popover)', border: '1px solid var(--border)' }}>
                                {agentList.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.id} className="text-xs">
                                        {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div style={{ padding: '6px 0' }}>
                        <label style={labelStyle}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description..."
                            style={{ ...fieldStyle, minHeight: 36, resize: 'none', opacity: 0.8 }}
                            rows={2}
                        />
                    </div>

                    {/* Date + Time + Duration */}
                    <div style={{ padding: '6px 0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div>
                                <label style={labelStyle}>
                                    <Calendar className="w-3 h-3" /> Date *
                                </label>
                                <input
                                    type="date"
                                    value={effectiveDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                    style={{ ...fieldStyle, fontSize: 11 }}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>
                                    <Clock className="w-3 h-3" /> Time
                                </label>
                                <input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    style={{ ...fieldStyle, fontSize: 11 }}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Duration (min)</label>
                                <input
                                    type="number"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                    min={5}
                                    style={{ ...fieldStyle, fontSize: 11 }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Priority */}
                    <div style={{ padding: '6px 0' }}>
                        <label style={labelStyle}>Priority</label>
                        <Select value={priority} onValueChange={setPriority}>
                            <SelectTrigger
                                className="shadow-none h-7 px-2.5 text-xs w-fit rounded-md"
                                style={{ color: 'var(--popover-foreground)', background: 'transparent', border: '1px solid var(--border)' }}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="text-xs" style={{ background: 'var(--popover)', border: '1px solid var(--border)' }}>
                                <SelectItem value="low" className="text-xs">Low</SelectItem>
                                <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                                <SelectItem value="high" className="text-xs">High</SelectItem>
                                <SelectItem value="critical" className="text-xs">Critical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Link to task */}
                    {pendingTasks.length > 0 && (
                        <div style={{ padding: '6px 0' }}>
                            <label style={labelStyle}>Link to Existing Task</label>
                            <Select value={linkedTaskId || '__none__'} onValueChange={handleTaskLink}>
                                <SelectTrigger
                                    className="shadow-none h-7 px-2.5 text-xs w-fit rounded-md"
                                    style={{ color: 'var(--popover-foreground)', background: 'transparent', border: '1px solid var(--border)' }}
                                >
                                    <SelectValue placeholder="None (standalone event)" />
                                </SelectTrigger>
                                <SelectContent className="text-xs" style={{ background: 'var(--popover)', border: '1px solid var(--border)' }}>
                                    <SelectItem value="__none__" className="text-xs">None</SelectItem>
                                    {pendingTasks.map((task) => (
                                        <SelectItem key={task.id} value={task.id} className="text-xs">
                                            {task.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Recurrence */}
                    <div style={{ padding: '6px 0' }}>
                        <label style={labelStyle}>
                            <Repeat className="w-3 h-3" /> Recurrence
                        </label>
                        <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                            <SelectTrigger
                                className="shadow-none h-7 px-2.5 text-xs w-fit rounded-md"
                                style={{ color: 'var(--popover-foreground)', background: 'transparent', border: '1px solid var(--border)' }}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="text-xs" style={{ background: 'var(--popover)', border: '1px solid var(--border)' }}>
                                <SelectItem value="none" className="text-xs">No recurrence</SelectItem>
                                <SelectItem value="hourly" className="text-xs">Hourly</SelectItem>
                                <SelectItem value="daily" className="text-xs">Daily</SelectItem>
                                <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                                <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
                            </SelectContent>
                        </Select>

                        {recurrenceType !== 'none' && (
                            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Every</span>
                                    <input
                                        type="number"
                                        value={recurrenceInterval}
                                        onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                                        min={1}
                                        style={{ ...fieldStyle, width: 40, fontSize: 11, textAlign: 'center' }}
                                    />
                                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{recurrenceLabel}</span>
                                </div>

                                {recurrenceType === 'weekly' && (
                                    <div>
                                        <label style={{ ...labelStyle, marginBottom: 6 }}>Days of Week</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {DAYS.map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => {
                                                        setRecurrenceDaysOfWeek(prev =>
                                                            prev.includes(value)
                                                                ? prev.filter(d => d !== value)
                                                                : [...prev, value]
                                                        );
                                                    }}
                                                    className={cn(
                                                        'w-6 h-6 rounded-full text-[10px] font-medium transition-all',
                                                        recurrenceDaysOfWeek.includes(value)
                                                            ? 'bg-[var(--accent-base)] text-[var(--text-on-accent)]'
                                                            : 'text-[var(--text-muted)] hover:text-[var(--popover-foreground)]',
                                                    )}
                                                    style={{
                                                        background: recurrenceDaysOfWeek.includes(value)
                                                            ? 'var(--accent-base)'
                                                            : 'color-mix(in srgb, var(--border) 50%, transparent)',
                                                        border: 'none',
                                                    }}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label style={{ ...labelStyle, marginBottom: 3 }}>Until (optional)</label>
                                    <input
                                        type="date"
                                        value={recurrenceEndDate}
                                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                        style={{ ...fieldStyle, fontSize: 11 }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 2 }}>
                    <button
                        onClick={() => { resetForm(); setCreateModalOpen(false); }}
                        style={{
                            height: 28,
                            padding: '0 14px',
                            fontSize: 12,
                            borderRadius: 4,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--popover-foreground)',
                            cursor: 'pointer',
                            transition: 'background 120ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{
                            height: 28,
                            padding: '0 14px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: 'none',
                            background: 'var(--accent-base)',
                            color: 'white',
                            cursor: 'pointer',
                            transition: 'background 120ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-base)')}
                    >
                        Create Event
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
