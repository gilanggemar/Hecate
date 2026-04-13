"use client";

import { usePMStore } from "@/store/usePMStore";
import { PRIORITY_LABELS, PRIORITY_DOTS, STATUS_LABELS } from "@/lib/pm/types";
import type {
    PMTaskStatus, PMAssigneeType, PMTimeEntry, PMApproval, DependencyType,
    PMExecutionStep, PMTaskGoal, PMTaskConstraint, PMTaskCustomFields, PMTaskAssignee, TaskOpsItemType,
} from "@/lib/pm/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    X, Bot, User, Zap, Clock, ListChecks, Send, Trash2, ChevronRight,
    Plus, Play, Square, Timer, CheckCircle2, XCircle, AlertCircle,
    Tag, Calendar, BarChart3, Link2, Search, ChevronDown, GripVertical,
    Target, Shield, DollarSign, Code2, Scale, MessageSquare, FileText, Cpu, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { usePresetStore, PresetType, PresetItem } from "@/lib/usePresetStore";
import { AGENT_ROSTER, getAgentProfile } from "@/lib/agentRoster";

type DetailTab = 'details' | 'subtasks' | 'dependencies' | 'time' | 'approvals';

const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
    finish_to_start: 'Finish to Start',
    start_to_start: 'Start to Start',
    finish_to_finish: 'Finish to Finish',
    start_to_finish: 'Start to Finish',
};

const TYPE_ICONS: Record<TaskOpsItemType, React.ReactNode> = {
    budget: <DollarSign className="w-3 h-3" />,
    stack: <Code2 className="w-3 h-3" />,
    legal: <Scale className="w-3 h-3" />,
    deadline: <Clock className="w-3 h-3" />,
    custom: <Shield className="w-3 h-3" />,
};

const TYPE_COLORS: Record<TaskOpsItemType, string> = {
    budget: '#f59e0b',
    stack: '#22d3ee',
    legal: '#a78bfa',
    deadline: '#ef4444',
    custom: '#71717a',
};

/* ─── Preset Popover (Goal / Constraint picker) ─── */
function PresetPopover({
    title, presets, onAdd, onDelete, onUpdate, onAddNewPreset, onClose,
}: {
    title: string;
    presets: PresetItem[];
    onAdd: (label: string, type: TaskOpsItemType) => void;
    onDelete: (presetId: string) => void;
    onUpdate: (presetId: string, newLabel: string) => void;
    onAddNewPreset: (label: string, type: TaskOpsItemType) => void;
    onClose: () => void;
}) {
    const [customLabel, setCustomLabel] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    useEffect(() => {
        if (editingId !== null && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const handleEditSubmit = (preset: PresetItem) => {
        if (editText.trim() && editText.trim() !== preset.label) {
            onUpdate(preset.id, editText.trim());
        }
        setEditingId(null);
    };

    return (
        <div ref={ref} className="absolute bottom-full left-0 mb-2 z-50 rounded-lg overflow-hidden shadow-xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', minWidth: 260 }}>
            <div className="p-3 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">{title}</span>
                <div className="flex flex-col gap-0.5">
                    {presets.map((p) => {
                        if (editingId === p.id) {
                            return (
                                <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1">
                                    <input ref={editInputRef} value={editText} onChange={e => setEditText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleEditSubmit(p); if (e.key === 'Escape') setEditingId(null); }}
                                        onBlur={() => handleEditSubmit(p)}
                                        className="flex-1 text-[11px] px-1.5 py-0.5 rounded-sm bg-transparent outline-none text-foreground border border-border" />
                                </div>
                            );
                        }
                        return (
                            <div key={p.id}
                                onDoubleClick={() => { setEditingId(p.id); setEditText(p.label); }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-all hover:bg-foreground/5 group cursor-default text-foreground">
                                <button onClick={(e) => { e.stopPropagation(); onAdd(p.label, p.type as TaskOpsItemType); onClose(); }}
                                    className="p-0.5 rounded-sm hover:bg-foreground/10 transition-colors opacity-50 group-hover:opacity-100 shrink-0">
                                    <Plus className="w-3 h-3" />
                                </button>
                                <span className="flex-1 select-none">{p.label}</span>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                                    className="p-0.5 rounded-sm hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0">
                                    <Trash2 className="w-3 h-3 text-red-500/70" />
                                </button>
                            </div>
                        );
                    })}
                </div>
                <button onClick={() => onAddNewPreset('New Preset', 'custom')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] transition-all hover:bg-foreground/5 border border-dashed border-border text-muted-foreground/30">
                    <Plus className="w-3.5 h-3.5" />
                </button>
                <div className="h-px w-full bg-border" />
                <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground/40">Quick add (once)</span>
                    <div className="flex gap-1.5">
                        <input value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && customLabel.trim()) { onAdd(customLabel.trim(), 'custom'); onClose(); } if (e.key === 'Escape') onClose(); }}
                            placeholder='e.g. "Max $5k spend"'
                            className="flex-1 text-[11px] px-2 py-1.5 rounded-sm bg-transparent outline-none text-foreground border border-border" />
                        <Button size="sm" disabled={!customLabel.trim()} className="h-7 px-2 rounded-md text-[10px]"
                            onClick={() => { if (customLabel.trim()) { onAdd(customLabel.trim(), 'custom'); onClose(); } }}>
                            Set
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Detail Panel ─── */
export function TaskDetailPanel() {
    const selectedTaskId = usePMStore((s) => s.selectedTaskId);
    const tasks = usePMStore((s) => s.tasks);
    const agents = usePMStore((s) => s.agents);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const updateTask = usePMStore((s) => s.updateTask);
    const deleteTask = usePMStore((s) => s.deleteTask);
    const createTask = usePMStore((s) => s.createTask);
    const logActivity = usePMStore((s) => s.logActivity);
    const fetchActivities = usePMStore((s) => s.fetchActivities);
    const activities = usePMStore((s) => s.activities);
    const dependencies = usePMStore((s) => s.dependencies);
    const addDependency = usePMStore((s) => s.addDependency);
    const removeDependency = usePMStore((s) => s.removeDependency);
    const updateDependency = usePMStore((s) => s.updateDependency);
    const getTaskDependencies = usePMStore((s) => s.getTaskDependencies);

    // Preset store (global goals/constraints)
    const goalPresets = usePresetStore((s) => s.goalPresets);
    const constraintPresets = usePresetStore((s) => s.constraintPresets);
    const addGoalPreset = usePresetStore((s) => s.addGoalPreset);
    const removeGoalPreset = usePresetStore((s) => s.removeGoalPreset);
    const updateGoalPreset = usePresetStore((s) => s.updateGoalPreset);
    const addConstraintPreset = usePresetStore((s) => s.addConstraintPreset);
    const removeConstraintPreset = usePresetStore((s) => s.removeConstraintPreset);
    const updateConstraintPreset = usePresetStore((s) => s.updateConstraintPreset);

    const task = useMemo(() => tasks.find((t) => t.id === selectedTaskId), [tasks, selectedTaskId]);
    const subtasks = useMemo(() => tasks.filter((t) => t.parent_task_id === selectedTaskId), [tasks, selectedTaskId]);
    const taskDeps = useMemo(() => {
        if (!selectedTaskId) return { predecessors: [], successors: [] };
        return getTaskDependencies(selectedTaskId);
    }, [selectedTaskId, dependencies, getTaskDependencies]);
    const totalDepCount = taskDeps.predecessors.length + taskDeps.successors.length;

    const [activeTab, setActiveTab] = useState<DetailTab>('details');
    const [comment, setComment] = useState("");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [showAddSubtask, setShowAddSubtask] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [openPanelDropdown, setOpenPanelDropdown] = useState<string | null>(null);

    // Dependencies
    const [addingDepType, setAddingDepType] = useState<'predecessor' | 'successor' | null>(null);
    const [depSearchQuery, setDepSearchQuery] = useState("");
    const depSearchRef = useRef<HTMLInputElement>(null);

    // Time tracking
    const [timeEntries, setTimeEntries] = useState<PMTimeEntry[]>([]);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
    const [timerStart, setTimerStart] = useState<Date | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [manualHours, setManualHours] = useState("");
    const [manualMinutes, setManualMinutes] = useState("");
    const [manualDescription, setManualDescription] = useState("");

    // Approvals
    const [approvals, setApprovals] = useState<PMApproval[]>([]);
    const [approvalName, setApprovalName] = useState("");

    // Task-Ops fields
    const [showGoalPicker, setShowGoalPicker] = useState(false);
    const [showConstraintPicker, setShowConstraintPicker] = useState(false);
    const [newStepText, setNewStepText] = useState("");
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);

    useEffect(() => {
        if (task) {
            fetchActivities('task', task.id);
            fetchTimeEntries(task.id);
            fetchApprovals(task.id);
        }
    }, [task?.id]);

    // Timer tick
    useEffect(() => {
        if (!isTimerRunning || !timerStart) return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isTimerRunning, timerStart]);

    const fetchTimeEntries = async (taskId: string) => {
        try {
            const res = await fetch(`/api/pm/time-entries?task_id=${taskId}`);
            const data = await res.json();
            setTimeEntries(data.entries || []);
            // Check for running timer
            const running = (data.entries || []).find((e: PMTimeEntry) => e.is_running);
            if (running) {
                setIsTimerRunning(true);
                setActiveTimerId(running.id);
                setTimerStart(new Date(running.start_time));
                setElapsed(Math.floor((Date.now() - new Date(running.start_time).getTime()) / 1000));
            }
        } catch { }
    };

    const fetchApprovals = async (taskId: string) => {
        try {
            const res = await fetch(`/api/pm/approvals?task_id=${taskId}`);
            const data = await res.json();
            setApprovals(data.approvals || []);
        } catch { }
    };

    // Searchable task list for dependency picker (must be before early return to maintain hook count)
    const depSearchResults = useMemo(() => {
        if (!depSearchQuery.trim() || !task) return [];
        const q = depSearchQuery.toLowerCase();
        return tasks.filter((t) => {
            if (t.id === task.id) return false;
            if (t.parent_task_id) return false;
            if (t.title.toLowerCase().includes(q)) return true;
            return false;
        }).slice(0, 8);
    }, [tasks, depSearchQuery, task]);

    if (!task) return null;

    // ── Custom fields helpers ──
    const cf = (task.custom_fields || {}) as PMTaskCustomFields;
    const executionPlan: PMExecutionStep[] = cf.execution_plan || [];
    const systemPrompt: string = cf.system_prompt || '';
    const goals: PMTaskGoal[] = cf.goals || [];
    const constraints: PMTaskConstraint[] = cf.constraints || [];
    const assignees: PMTaskAssignee[] = cf.assignees || [];

    const updateCustomFields = (updates: Partial<PMTaskCustomFields>) => {
        updateTask(task.id, {
            custom_fields: { ...cf, ...updates },
        });
    };

    const getAgentName = (agentId: string | null) => {
        if (!agentId) return null;
        return agents.find((a) => a.id === agentId)?.name || agentId;
    };

    const handleStatusChange = (status: PMTaskStatus) => {
        const old = task.status;
        updateTask(task.id, { status, progress: status === 'DONE' ? 100 : task.progress });
        logActivity('task', task.id, 'status_change', `Status changed from ${STATUS_LABELS[old]} to ${STATUS_LABELS[status]}`, 'system', 'System');
    };

    const handleComment = () => {
        if (!comment.trim()) return;
        logActivity('task', task.id, 'comment', comment.trim(), 'human', 'You');
        setComment("");
    };

    const handleDelete = () => {
        deleteTask(task.id);
        setSelectedTask(null);
    };

    // ── Subtask ──
    const handleAddSubtask = async () => {
        if (!newSubtaskTitle.trim()) return;
        await createTask({
            title: newSubtaskTitle.trim(),
            parent_task_id: task.id,
            space_id: task.space_id,
            folder_id: task.folder_id,
        });
        setNewSubtaskTitle("");
        logActivity('task', task.id, 'created', `Added subtask: ${newSubtaskTitle.trim()}`, 'human', 'You');
    };

    // ── Tags ──
    const handleAddTag = () => {
        if (!tagInput.trim()) return;
        const newTag = tagInput.trim().toLowerCase();
        if (task.tags?.includes(newTag)) { setTagInput(""); return; }
        updateTask(task.id, { tags: [...(task.tags || []), newTag] });
        setTagInput("");
    };

    const handleRemoveTag = (tag: string) => {
        updateTask(task.id, { tags: (task.tags || []).filter((t: string) => t !== tag) });
    };

    // ── Timer ──
    const startTimer = async () => {
        try {
            const res = await fetch('/api/pm/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: task.id, is_running: true }),
            });
            const data = await res.json();
            setIsTimerRunning(true);
            setActiveTimerId(data.id);
            setTimerStart(new Date());
            setElapsed(0);
        } catch { }
    };

    const stopTimer = async () => {
        if (!activeTimerId) return;
        const duration = Math.ceil(elapsed / 60);
        try {
            await fetch('/api/pm/time-entries', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activeTimerId,
                    end_time: new Date().toISOString(),
                    duration_minutes: duration,
                    is_running: false,
                }),
            });
            setIsTimerRunning(false);
            setActiveTimerId(null);
            setTimerStart(null);
            setElapsed(0);
            fetchTimeEntries(task.id);
            logActivity('task', task.id, 'updated', `Logged ${duration}m via timer`, 'human', 'You');
        } catch { }
    };

    const addManualEntry = async () => {
        const mins = (parseInt(manualHours || '0') * 60) + parseInt(manualMinutes || '0');
        if (mins <= 0) return;
        try {
            await fetch('/api/pm/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: task.id,
                    is_manual: true,
                    is_running: false,
                    duration_minutes: mins,
                    description: manualDescription,
                    end_time: new Date().toISOString(),
                }),
            });
            setManualHours("");
            setManualMinutes("");
            setManualDescription("");
            fetchTimeEntries(task.id);
            logActivity('task', task.id, 'updated', `Logged ${mins}m manually`, 'human', 'You');
        } catch { }
    };

    const deleteTimeEntry = async (entryId: string) => {
        try {
            await fetch(`/api/pm/time-entries?id=${entryId}`, { method: 'DELETE' });
            setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
        } catch { }
    };

    // ── Approvals ──
    const requestApproval = async () => {
        if (!approvalName.trim()) return;
        const isAgent = agents.find((a) => a.name.toLowerCase() === approvalName.toLowerCase());
        try {
            await fetch('/api/pm/approvals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: task.id,
                    approver_type: isAgent ? 'agent' : 'human',
                    approver_name: approvalName.trim(),
                }),
            });
            setApprovalName("");
            fetchApprovals(task.id);
            logActivity('task', task.id, 'updated', `Requested approval from ${approvalName.trim()}`, 'human', 'You');
        } catch { }
    };

    const resolveApproval = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await fetch('/api/pm/approvals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            fetchApprovals(task.id);
        } catch { }
    };

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const totalTrackedMinutes = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const totalTrackedDisplay = `${Math.floor(totalTrackedMinutes / 60)}h ${totalTrackedMinutes % 60}m`;

    const isOverdue = task.due_date && task.status !== 'DONE' && new Date(task.due_date) < new Date();

    const TABS: { id: DetailTab; label: string; icon: typeof Clock; count?: number }[] = [
        { id: 'details', label: 'Details', icon: BarChart3 },
        { id: 'subtasks', label: 'Subtasks', icon: ListChecks, count: subtasks.length },
        { id: 'dependencies', label: 'Deps', icon: Link2, count: totalDepCount },
        { id: 'approvals', label: 'Approvals', icon: CheckCircle2, count: approvals.length },
    ];

    const handleAddDep = async (targetTaskId: string) => {
        if (!task) return;
        if (addingDepType === 'predecessor') {
            await addDependency(targetTaskId, task.id);
            logActivity('task', task.id, 'updated', `Added predecessor dependency`, 'human', 'You');
        } else {
            await addDependency(task.id, targetTaskId);
            logActivity('task', task.id, 'updated', `Added successor dependency`, 'human', 'You');
        }
        setAddingDepType(null);
        setDepSearchQuery("");
    };

    const handleRemoveDep = async (depId: string) => {
        await removeDependency(depId);
        if (task) logActivity('task', task.id, 'updated', `Removed dependency`, 'human', 'You');
    };

    // ── Execution Plan helpers ──
    const addExecutionStep = () => {
        if (!newStepText.trim()) return;
        const newStep: PMExecutionStep = {
            id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: newStepText.trim(),
            order: executionPlan.length,
        };
        updateCustomFields({ execution_plan: [...executionPlan, newStep] });
        setNewStepText("");
    };

    const removeExecutionStep = (stepId: string) => {
        updateCustomFields({
            execution_plan: executionPlan.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i })),
        });
    };

    const reorderExecutionPlan = (newOrder: PMExecutionStep[]) => {
        updateCustomFields({
            execution_plan: newOrder.map((s, i) => ({ ...s, order: i })),
        });
    };

    // ── Goals / Constraints helpers ──
    const addGoal = (label: string, type: TaskOpsItemType) => {
        const newGoal: PMTaskGoal = {
            id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            label,
        };
        updateCustomFields({ goals: [...goals, newGoal] });
    };

    const removeGoal = (goalId: string) => {
        updateCustomFields({ goals: goals.filter((g) => g.id !== goalId) });
    };

    const addConstraint = (label: string, type: TaskOpsItemType) => {
        const newConstraint: PMTaskConstraint = {
            id: `cons-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            label,
        };
        updateCustomFields({ constraints: [...constraints, newConstraint] });
    };

    const removeConstraint = (consId: string) => {
        updateCustomFields({ constraints: constraints.filter((c) => c.id !== consId) });
    };

    // ── Multi-Assignee helpers ──
    const addAssignee = (agentId: string) => {
        if (assignees.some((a) => a.id === agentId)) return;
        const newAssignee: PMTaskAssignee = { id: agentId, type: 'agent' };
        const updated = [...assignees, newAssignee];
        updateCustomFields({ assignees: updated });
        // Also set the primary agent_id to the first assignee
        if (!task.agent_id) {
            updateTask(task.id, { agent_id: agentId, assignee_type: 'agent' });
        }
    };

    const removeAssignee = (agentId: string) => {
        const updated = assignees.filter((a) => a.id !== agentId);
        updateCustomFields({ assignees: updated });
        // If removed the primary agent, set to first remaining or null
        if (task.agent_id === agentId) {
            updateTask(task.id, {
                agent_id: updated.length > 0 ? updated[0].id : null,
                assignee_type: updated.length > 0 ? 'agent' : 'auto',
            });
        }
    };

    const availableAgents = AGENT_ROSTER.filter((a) => !assignees.some((as) => as.id === a.id));

    return (
        <div className="pm-detail-panel border-l border-border/30 flex flex-col h-full bg-background overflow-hidden shrink-0"
            style={{ width: '55vw', maxWidth: 800, minWidth: 520 }}>
            {/* ── Header: Title + Actions ── */}
            <div className="px-5 py-3.5 border-b border-border/20">
                <div className="flex items-center gap-2">
                    {/* Editable title */}
                    <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={() => { if (editTitle.trim()) updateTask(task.id, { title: editTitle.trim() }); setIsEditingTitle(false); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { if (editTitle.trim()) updateTask(task.id, { title: editTitle.trim() }); setIsEditingTitle(false); } }}
                                className="text-[15px] font-semibold h-auto py-0.5 border-none bg-transparent shadow-none focus-visible:ring-0 px-0"
                                autoFocus
                            />
                        ) : (
                            <h3
                                onClick={() => { setEditTitle(task.title); setIsEditingTitle(true); }}
                                className="text-[15px] font-semibold text-foreground tracking-tight cursor-text hover:text-accent-base transition-colors truncate"
                            >
                                {task.title}
                            </h3>
                        )}
                    </div>
                    {assignees.length > 1 && (
                        <span className="flex items-center gap-1 text-[9px] text-accent-violet/70 bg-accent-violet/5 px-1.5 py-0.5 rounded shrink-0">
                            <Users className="w-2.5 h-2.5" />
                            Multi-Agent
                        </span>
                    )}
                    <button onClick={handleDelete} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setSelectedTask(null)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Metadata row: status, priority, overdue, deps */}
                <div className="flex items-center gap-2 mt-2.5">
                    {/* Status dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setOpenPanelDropdown(openPanelDropdown === 'status' ? null : 'status')}
                            className={cn(
                                "flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border bg-transparent cursor-pointer transition-colors",
                                task.status === 'NEW' ? "border-blue-500/30 text-blue-400" :
                                task.status === 'DONE' ? "border-accent-lime/30 text-accent-lime" :
                                task.status === 'IN_PROGRESS' ? "border-accent-base/30 text-accent-base" :
                                task.status === 'FAILED' ? "border-red-500/30 text-red-400" :
                                "border-border/50 text-muted-foreground"
                            )}
                        >
                            {STATUS_LABELS[task.status]}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                        <AnimatePresence>
                            {openPanelDropdown === 'status' && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenPanelDropdown(null)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                        className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[140px] space-y-0.5"
                                    >
                                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                            <button
                                                key={k}
                                                onClick={() => { handleStatusChange(k as PMTaskStatus); setOpenPanelDropdown(null); }}
                                                className={cn(
                                                    "w-full text-left text-[11px] px-2.5 py-1.5 rounded-md transition-colors",
                                                    task.status === k
                                                        ? "bg-accent-base/10 text-accent-base"
                                                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                                )}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    {/* Priority dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setOpenPanelDropdown(openPanelDropdown === 'priority' ? null : 'priority')}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border border-border/50 bg-transparent text-muted-foreground cursor-pointer transition-colors"
                        >
                            {PRIORITY_LABELS[task.priority]}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                        <AnimatePresence>
                            {openPanelDropdown === 'priority' && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenPanelDropdown(null)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                        className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[120px] space-y-0.5"
                                    >
                                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                            <button
                                                key={k}
                                                onClick={() => { updateTask(task.id, { priority: Number(k) as any }); setOpenPanelDropdown(null); }}
                                                className={cn(
                                                    "w-full text-left text-[11px] px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-2",
                                                    task.priority === Number(k)
                                                        ? "bg-accent-base/10 text-accent-base"
                                                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                                )}
                                            >
                                                <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOTS[Number(k)])} />
                                                {v}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    {isOverdue && (
                        <span className="text-[9px] text-red-400 flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" /> Overdue
                        </span>
                    )}
                    {totalDepCount > 0 && (
                        <button
                            onClick={() => setActiveTab('dependencies')}
                            className="flex items-center gap-1 text-[9px] text-accent-base/70 hover:text-accent-base transition-colors px-1.5 py-0.5 rounded-md bg-accent-base/5 hover:bg-accent-base/10"
                        >
                            <Link2 className="w-2.5 h-2.5" />
                            {totalDepCount} dep{totalDepCount > 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center px-3 pt-2 pb-0 border-b border-border/20">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors border-b-2 -mb-px",
                            activeTab === tab.id
                                ? "border-accent-base text-foreground"
                                : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
                        )}
                    >
                        <tab.icon className="w-3 h-3" />
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="text-[8px] bg-foreground/5 rounded-full w-4 h-4 flex items-center justify-center tabular-nums">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ═══ TWO-COLUMN BODY ═══ */}
            <div className="flex-1 flex min-h-0 overflow-hidden">

                {/* ── LEFT COLUMN: Controls ── */}
                <div className="flex-1 overflow-hidden px-4 py-3 border-r border-border/20 min-w-0">

                    {/* ═══ DETAILS TAB ═══ */}
                    {activeTab === 'details' && (
                        <div className="flex flex-col gap-3 h-full pt-1">
                            {/* Multi-Assignee Section */}
                            <div className="rounded-lg border border-border/20 p-2.5 space-y-1 bg-foreground/[0.01]">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="w-3 h-3" /> Assigned Agents
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {assignees.map((a) => {
                                        const profile = getAgentProfile(a.id);
                                        return (
                                            <div key={a.id}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/30 bg-foreground/2 group transition-colors hover:border-border/60">
                                                <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                                                    style={{ background: profile?.colorHex || '#666', borderRadius: 'var(--radius-sm, 4px)' }}>
                                                    {profile?.avatarFallback || a.id.slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-[11px] text-foreground">{profile?.name || a.id}</span>
                                                <button onClick={() => removeAssignee(a.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X className="w-3 h-3 text-muted-foreground/40 hover:text-red-400" />
                                                </button>
                                            </div>
                                        );
                                    })}

                                    {/* Add assignee button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border/40 text-[10px] text-muted-foreground/40 hover:text-muted-foreground hover:border-border/60 transition-colors"
                                        >
                                            <Plus className="w-3 h-3" />
                                            {assignees.length === 0 ? 'Assign Agent' : 'Add'}
                                        </button>
                                        <AnimatePresence>
                                            {showAssigneePicker && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setShowAssigneePicker(false)} />
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 4 }}
                                                        className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[180px]"
                                                    >
                                                        {availableAgents.length === 0 ? (
                                                            <p className="text-[10px] text-muted-foreground/30 text-center py-2 px-3">All agents assigned</p>
                                                        ) : (
                                                            availableAgents.map((agent) => (
                                                                <button key={agent.id}
                                                                    onClick={() => { addAssignee(agent.id); setShowAssigneePicker(false); }}
                                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-foreground hover:bg-foreground/5 transition-colors">
                                                                    <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white"
                                                                        style={{ background: agent.colorHex, borderRadius: 'var(--radius-sm, 4px)' }}>
                                                                        {agent.avatarFallback}
                                                                    </div>
                                                                    <span>{agent.name}</span>
                                                                    <span className="text-[9px] text-muted-foreground/30 ml-auto">{agent.role}</span>
                                                                </button>
                                                            ))
                                                        )}
                                                    </motion.div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                                {assignees.length > 1 && (
                                    <p className="text-[9px] text-accent-violet/50 flex items-center gap-1">
                                        <Cpu className="w-3 h-3" />
                                        Collaborative mode — agents share context and coordinate execution
                                    </p>
                                )}
                            </div>

                            {/* ── Dates ── */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Start Date</label>
                                    <DatePicker
                                        value={task.start_date || null}
                                        onChange={(date) => updateTask(task.id, { start_date: date })}
                                        placeholder="Set start date"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Due Date</label>
                                    <DatePicker
                                        value={task.due_date || null}
                                        onChange={(date) => updateTask(task.id, { due_date: date })}
                                        placeholder="Set due date"
                                        isError={!!isOverdue}
                                    />
                                </div>
                            </div>

                            {/* ── Progress ── */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Progress</label>
                                    <span className="text-[11px] text-muted-foreground/50 tabular-nums font-medium">{task.progress}%</span>
                                </div>
                                <input
                                    type="range" min={0} max={100} step={5}
                                    value={task.progress}
                                    onChange={(e) => updateTask(task.id, { progress: parseInt(e.target.value) })}
                                    className="w-full h-1.5 rounded-full appearance-none bg-foreground/8 accent-accent-base cursor-pointer"
                                />
                            </div>
                            {totalTrackedMinutes > 0 && (
                                <div className="flex items-center gap-2">
                                    <Timer className="w-3.5 h-3.5 text-accent-base" />
                                    <span className="text-[11px] text-foreground font-medium">{totalTrackedDisplay}</span>
                                    <span className="text-[10px] text-muted-foreground/40">tracked</span>
                                </div>
                            )}

                            {/* ── Execution Plan Card ── */}
                            <div className="rounded-lg border border-border/20 p-2.5 space-y-1.5 bg-foreground/[0.01]">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="w-3 h-3" /> Execution Plan
                                    {executionPlan.length > 0 && (
                                        <span className="text-[8px] bg-foreground/5 rounded-full w-4 h-4 flex items-center justify-center tabular-nums">{executionPlan.length}</span>
                                    )}
                                </label>
                                {executionPlan.length > 0 && (
                                    <Reorder.Group
                                        axis="y"
                                        values={executionPlan}
                                        onReorder={reorderExecutionPlan}
                                        className="space-y-1"
                                    >
                                        {executionPlan.map((step, idx) => (
                                            <Reorder.Item key={step.id} value={step}>
                                                <div className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-foreground/2 border border-border/20 group hover:border-border/40 transition-colors">
                                                    <GripVertical className="w-3 h-3 text-muted-foreground/20 mt-0.5 cursor-grab shrink-0" />
                                                    <span className="text-[10px] text-muted-foreground/30 font-mono mt-0.5 shrink-0">{idx + 1}.</span>
                                                    <span className="text-[11px] text-foreground flex-1 leading-relaxed">{step.text}</span>
                                                    <button onClick={() => removeExecutionStep(step.id)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0">
                                                        <X className="w-3 h-3 text-muted-foreground/30 hover:text-red-400" />
                                                    </button>
                                                </div>
                                            </Reorder.Item>
                                        ))}
                                    </Reorder.Group>
                                )}
                                <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-dashed border-border/20">
                                    <input
                                        value={newStepText}
                                        onChange={(e) => setNewStepText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') addExecutionStep(); }}
                                        placeholder="Add a step..."
                                        className="flex-1 text-[11px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/20"
                                    />
                                    {newStepText.trim() && (
                                        <button onClick={addExecutionStep} className="text-accent-base hover:text-accent-base/80 transition-colors">
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ── System Prompt ── */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <Cpu className="w-3 h-3" /> System Prompt
                                    <span className="text-[8px] text-muted-foreground/20 font-normal normal-case">(optional)</span>
                                </label>
                                <Textarea
                                    value={systemPrompt}
                                    onChange={(e) => updateCustomFields({ system_prompt: e.target.value })}
                                    placeholder="Inject additional instructions for the agent..."
                                    className="min-h-16 text-[11px] rounded-lg border-border bg-card resize-none font-mono"
                                />
                            </div>

                            {/* ── Goals & Constraints Card ── */}
                            <div className="rounded-lg border border-border/20 bg-foreground/[0.01] grid grid-cols-2">
                                {/* Goals */}
                                <div className="px-2.5 py-2 space-y-1 relative border-r border-border/15">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <Target className="w-3 h-3" /> Goals
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {goals.map((g) => (
                                        <span key={g.id}
                                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-border/30 bg-foreground/2 group">
                                            <span style={{ color: TYPE_COLORS[g.type] }}>{TYPE_ICONS[g.type]}</span>
                                            <span className="text-foreground">{g.label}</span>
                                            <button onClick={() => removeGoal(g.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-2.5 h-2.5 text-muted-foreground/30 hover:text-red-400" />
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        onClick={() => { setShowGoalPicker(!showGoalPicker); setShowConstraintPicker(false); }}
                                        className="flex items-center gap-1 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                                    >
                                        <Plus className="w-3 h-3" /> Add Goal
                                    </button>
                                </div>
                                {showGoalPicker && (
                                    <PresetPopover
                                        title="Goal Presets"
                                        presets={goalPresets}
                                        onAdd={(label, type) => addGoal(label, type)}
                                        onDelete={removeGoalPreset}
                                        onUpdate={updateGoalPreset}
                                        onAddNewPreset={(label, type) => addGoalPreset(type as PresetType, label)}
                                        onClose={() => setShowGoalPicker(false)}
                                    />
                                )}
                                </div>
                                {/* Constraints */}
                                <div className="px-2.5 py-2 space-y-1 relative">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield className="w-3 h-3" /> Constraints
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {constraints.map((c) => (
                                        <span key={c.id}
                                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-border/30 bg-foreground/2 group">
                                            <span style={{ color: TYPE_COLORS[c.type] }}>{TYPE_ICONS[c.type]}</span>
                                            <span className="text-foreground">{c.label}</span>
                                            <button onClick={() => removeConstraint(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-2.5 h-2.5 text-muted-foreground/30 hover:text-red-400" />
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        onClick={() => { setShowConstraintPicker(!showConstraintPicker); setShowGoalPicker(false); }}
                                        className="flex items-center gap-1 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                                    >
                                        <Plus className="w-3 h-3" /> Add Constraint
                                    </button>
                                </div>
                                {showConstraintPicker && (
                                    <PresetPopover
                                        title="Constraint Presets"
                                        presets={constraintPresets}
                                        onAdd={(label, type) => addConstraint(label, type)}
                                        onDelete={removeConstraintPreset}
                                        onUpdate={updateConstraintPreset}
                                        onAddNewPreset={(label, type) => addConstraintPreset(type as PresetType, label)}
                                        onClose={() => setShowConstraintPicker(false)}
                                    />
                                )}
                                </div>
                            </div>

                            {/* ── Tags ── */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Tags</label>
                                <div className="flex flex-wrap gap-1">
                                    {(task.tags || []).map((tag: string) => (
                                        <span key={tag} className="flex items-center gap-1 text-[10px] bg-foreground/5 text-muted-foreground/70 rounded px-2 py-0.5 group/tag">
                                            <Tag className="w-2.5 h-2.5" />
                                            {tag}
                                            <button onClick={() => handleRemoveTag(tag)} className="opacity-0 group-hover/tag:opacity-100 transition-opacity">
                                                <X className="w-2.5 h-2.5 hover:text-red-400" />
                                            </button>
                                        </span>
                                    ))}
                                    <input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                                        placeholder="+ add tag"
                                        className="text-[10px] bg-transparent border-none outline-none text-muted-foreground/30 placeholder:text-muted-foreground/20 w-16"
                                    />
                                </div>
                            </div>

                            {/* ── Description ── */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Description</label>
                                <Textarea
                                    value={task.description || ''}
                                    onChange={(e) => updateTask(task.id, { description: e.target.value })}
                                    placeholder="Add a description..."
                                    className="min-h-16 text-[11px] rounded-lg border-border bg-card resize-none"
                                />
                            </div>

                        </div>
                    )}

                    {/* ═══ SUBTASKS TAB ═══ */}
                    {activeTab === 'subtasks' && (
                        <>
                            {subtasks.length > 0 && (
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex-1 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-accent-lime/60 transition-all"
                                            style={{ width: `${(subtasks.filter((s) => s.status === 'DONE').length / subtasks.length) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                                        {subtasks.filter((s) => s.status === 'DONE').length}/{subtasks.length}
                                    </span>
                                </div>
                            )}

                            <div className="space-y-0.5">
                                {subtasks.map((sub) => (
                                    <div
                                        key={sub.id}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/3 transition-colors group"
                                    >
                                        <button
                                            onClick={() => updateTask(sub.id, { status: sub.status === 'DONE' ? 'PENDING' : 'DONE', progress: sub.status === 'DONE' ? 0 : 100 })}
                                            className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                                sub.status === 'DONE'
                                                    ? "bg-accent-lime border-accent-lime"
                                                    : "border-border/50 hover:border-accent-lime"
                                            )}
                                        >
                                            {sub.status === 'DONE' && <CheckCircle2 className="w-3 h-3 text-background" />}
                                        </button>
                                        <span
                                            onClick={() => setSelectedTask(sub.id)}
                                            className={cn(
                                                "flex-1 text-[11px] cursor-pointer hover:text-accent-base transition-colors truncate",
                                                sub.status === 'DONE' ? "line-through text-muted-foreground/40" : "text-foreground"
                                            )}
                                        >
                                            {sub.title}
                                        </span>
                                        {sub.agent_id && (
                                            <span className="text-[9px] text-muted-foreground/30 truncate max-w-[50px]">
                                                {getAgentName(sub.agent_id)}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => deleteTask(sub.id)}
                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add subtask */}
                            {showAddSubtask ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        autoFocus
                                        value={newSubtaskTitle}
                                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddSubtask();
                                            if (e.key === 'Escape') { setShowAddSubtask(false); setNewSubtaskTitle(""); }
                                        }}
                                        onBlur={() => { if (!newSubtaskTitle.trim()) setShowAddSubtask(false); }}
                                        placeholder="Subtask name..."
                                        className="flex-1 text-[11px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowAddSubtask(true)}
                                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors mt-1"
                                >
                                    <Plus className="w-3 h-3" /> Add subtask
                                </button>
                            )}
                        </>
                    )}

                    {/* ═══ DEPENDENCIES TAB ═══ */}
                    {activeTab === 'dependencies' && (
                        <>
                            {totalDepCount > 0 && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-foreground/3">
                                    <Link2 className="w-3.5 h-3.5 text-accent-base" />
                                    <span className="text-[12px] text-foreground font-semibold">{totalDepCount} dependenc{totalDepCount === 1 ? 'y' : 'ies'}</span>
                                </div>
                            )}

                            {/* ── Predecessors ── */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
                                    Predecessors
                                </label>
                                <p className="text-[9px] text-muted-foreground/25 -mt-0.5">Tasks that must finish before this task can begin</p>

                                {taskDeps.predecessors.map((dep) => {
                                    const predTask = tasks.find((t) => t.id === dep.predecessor_id);
                                    if (!predTask) return null;
                                    return (
                                        <div key={dep.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-foreground/2 border border-border/20 group">
                                            <div className={cn("w-2 h-2 rounded-full shrink-0", {
                                                'bg-blue-500': predTask.status === 'NEW',
                                                'bg-zinc-500': predTask.status === 'PENDING',
                                                'bg-accent-base': predTask.status === 'IN_PROGRESS',
                                                'bg-accent-lime': predTask.status === 'DONE',
                                                'bg-red-500': predTask.status === 'FAILED',
                                            })} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-medium text-foreground truncate cursor-pointer hover:text-accent-base transition-colors"
                                                    onClick={() => setSelectedTask(predTask.id)}>
                                                    {predTask.title}
                                                </p>
                                                {predTask.due_date && (
                                                    <p className="text-[9px] text-muted-foreground/30">
                                                        {new Date(predTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </p>
                                                )}
                                            </div>
                                            <select
                                                value={dep.dependency_type}
                                                onChange={(e) => updateDependency(dep.id, { dependency_type: e.target.value as DependencyType })}
                                                className="text-[8px] bg-transparent border border-border/30 rounded px-1 py-0.5 text-muted-foreground/50 outline-none cursor-pointer"
                                            >
                                                {Object.entries(DEPENDENCY_TYPE_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k}>{v}</option>
                                                ))}
                                            </select>
                                            <button onClick={() => handleRemoveDep(dep.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-3 h-3 text-muted-foreground/30 hover:text-red-400" />
                                            </button>
                                        </div>
                                    );
                                })}

                                {addingDepType === 'predecessor' ? (
                                    <div className="relative">
                                        <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-accent-base/30">
                                            <Search className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                                            <input
                                                ref={depSearchRef}
                                                autoFocus
                                                value={depSearchQuery}
                                                onChange={(e) => setDepSearchQuery(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Escape') { setAddingDepType(null); setDepSearchQuery(""); } }}
                                                placeholder="Search tasks..."
                                                className="flex-1 text-[11px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30"
                                            />
                                            <button onClick={() => { setAddingDepType(null); setDepSearchQuery(""); }}>
                                                <X className="w-3 h-3 text-muted-foreground/30 hover:text-foreground" />
                                            </button>
                                        </div>
                                        {depSearchResults.length > 0 && (
                                            <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border/50 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                                {depSearchResults.map((t) => {
                                                    const alreadyLinked = taskDeps.predecessors.some(d => d.predecessor_id === t.id);
                                                    return (
                                                        <button key={t.id} onClick={() => !alreadyLinked && handleAddDep(t.id)} disabled={alreadyLinked}
                                                            className={cn("w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-border/10 last:border-0",
                                                                alreadyLinked ? "opacity-30 cursor-not-allowed" : "hover:bg-accent-base/5 cursor-pointer")}>
                                                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", {
                                                                'bg-zinc-500': t.status === 'PENDING', 'bg-accent-base': t.status === 'IN_PROGRESS',
                                                                'bg-accent-lime': t.status === 'DONE', 'bg-red-500': t.status === 'FAILED',
                                                            })} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-medium text-foreground truncate">{t.title}</p>
                                                                <p className="text-[8px] text-muted-foreground/30 truncate">{STATUS_LABELS[t.status]}{alreadyLinked && ' · Already linked'}</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {depSearchQuery.trim() && depSearchResults.length === 0 && (
                                            <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border/50 shadow-xl p-3">
                                                <p className="text-[10px] text-muted-foreground/30 text-center">No matching tasks found</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button onClick={() => { setAddingDepType('predecessor'); setDepSearchQuery(""); }}
                                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                                        <Plus className="w-3 h-3" /> Predecessor
                                    </button>
                                )}
                            </div>

                            {/* ── Successors ── */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Successors</label>
                                <p className="text-[9px] text-muted-foreground/25 -mt-0.5">Tasks that should begin after this task finishes</p>

                                {taskDeps.successors.map((dep) => {
                                    const succTask = tasks.find((t) => t.id === dep.successor_id);
                                    if (!succTask) return null;
                                    return (
                                        <div key={dep.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-foreground/2 border border-border/20 group">
                                            <div className={cn("w-2 h-2 rounded-full shrink-0", {
                                                'bg-blue-500': succTask.status === 'NEW',
                                                'bg-zinc-500': succTask.status === 'PENDING',
                                                'bg-accent-base': succTask.status === 'IN_PROGRESS',
                                                'bg-accent-lime': succTask.status === 'DONE',
                                                'bg-red-500': succTask.status === 'FAILED',
                                            })} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-medium text-foreground truncate cursor-pointer hover:text-accent-base transition-colors"
                                                    onClick={() => setSelectedTask(succTask.id)}>
                                                    {succTask.title}
                                                </p>
                                                {succTask.due_date && (
                                                    <p className="text-[9px] text-muted-foreground/30">
                                                        {new Date(succTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </p>
                                                )}
                                            </div>
                                            <select
                                                value={dep.dependency_type}
                                                onChange={(e) => updateDependency(dep.id, { dependency_type: e.target.value as DependencyType })}
                                                className="text-[8px] bg-transparent border border-border/30 rounded px-1 py-0.5 text-muted-foreground/50 outline-none cursor-pointer"
                                            >
                                                {Object.entries(DEPENDENCY_TYPE_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k}>{v}</option>
                                                ))}
                                            </select>
                                            <button onClick={() => handleRemoveDep(dep.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-3 h-3 text-muted-foreground/30 hover:text-red-400" />
                                            </button>
                                        </div>
                                    );
                                })}

                                {addingDepType === 'successor' ? (
                                    <div className="relative">
                                        <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-accent-base/30">
                                            <Search className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                                            <input
                                                autoFocus
                                                value={depSearchQuery}
                                                onChange={(e) => setDepSearchQuery(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Escape') { setAddingDepType(null); setDepSearchQuery(""); } }}
                                                placeholder="Search tasks..."
                                                className="flex-1 text-[11px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30"
                                            />
                                            <button onClick={() => { setAddingDepType(null); setDepSearchQuery(""); }}>
                                                <X className="w-3 h-3 text-muted-foreground/30 hover:text-foreground" />
                                            </button>
                                        </div>
                                        {depSearchResults.length > 0 && (
                                            <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border/50 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                                {depSearchResults.map((t) => {
                                                    const alreadyLinked = taskDeps.successors.some(d => d.successor_id === t.id);
                                                    return (
                                                        <button key={t.id} onClick={() => !alreadyLinked && handleAddDep(t.id)} disabled={alreadyLinked}
                                                            className={cn("w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-border/10 last:border-0",
                                                                alreadyLinked ? "opacity-30 cursor-not-allowed" : "hover:bg-accent-base/5 cursor-pointer")}>
                                                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", {
                                                                'bg-zinc-500': t.status === 'PENDING', 'bg-accent-base': t.status === 'IN_PROGRESS',
                                                                'bg-accent-lime': t.status === 'DONE', 'bg-red-500': t.status === 'FAILED',
                                                            })} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-medium text-foreground truncate">{t.title}</p>
                                                                <p className="text-[8px] text-muted-foreground/30 truncate">{STATUS_LABELS[t.status]}{alreadyLinked && ' · Already linked'}</p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {depSearchQuery.trim() && depSearchResults.length === 0 && (
                                            <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border/50 shadow-xl p-3">
                                                <p className="text-[10px] text-muted-foreground/30 text-center">No matching tasks found</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button onClick={() => { setAddingDepType('successor'); setDepSearchQuery(""); }}
                                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                                        <Plus className="w-3 h-3" /> Successor
                                    </button>
                                )}
                            </div>

                            {totalDepCount === 0 && !addingDepType && (
                                <div className="flex flex-col items-center justify-center py-8 gap-2">
                                    <Link2 className="w-5 h-5 text-muted-foreground/15" />
                                    <p className="text-[11px] text-muted-foreground/25">No dependencies yet</p>
                                    <p className="text-[9px] text-muted-foreground/20 text-center max-w-[200px]">
                                        Add predecessors (tasks that must finish first) or successors (tasks that follow)
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══ TIME TRACKING TAB ═══ */}
                    {activeTab === 'time' && (
                        <>
                            {/* Live Timer */}
                            <div className="p-3 rounded-xl bg-foreground/3 border border-border/20 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Timer</span>
                                    {isTimerRunning ? (
                                        <span className="flex items-center gap-1 text-[9px] text-accent-base">
                                            <span className="w-1.5 h-1.5 rounded-full bg-accent-base animate-pulse" />
                                            Running
                                        </span>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={cn(
                                        "text-2xl font-mono tabular-nums tracking-tight",
                                        isTimerRunning ? "text-accent-base" : "text-muted-foreground/30"
                                    )}>
                                        {formatTime(elapsed)}
                                    </span>
                                    {isTimerRunning ? (
                                        <Button size="sm" onClick={stopTimer} className="h-8 w-8 p-0 rounded-full bg-red-500 hover:bg-red-600">
                                            <Square className="w-3 h-3 fill-current" />
                                        </Button>
                                    ) : (
                                        <Button size="sm" onClick={startTimer} className="h-8 w-8 p-0 rounded-full bg-accent-base hover:bg-accent-base/90">
                                            <Play className="w-3 h-3 fill-current ml-0.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Manual Entry */}
                            <div className="space-y-2">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Manual Entry</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <input value={manualHours} onChange={(e) => setManualHours(e.target.value.replace(/\D/g, ''))} placeholder="0"
                                            className="w-10 h-7 text-center text-[11px] rounded-md bg-card border border-border outline-none text-foreground" />
                                        <span className="text-[9px] text-muted-foreground/40">h</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <input value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value.replace(/\D/g, ''))} placeholder="0"
                                            className="w-10 h-7 text-center text-[11px] rounded-md bg-card border border-border outline-none text-foreground" />
                                        <span className="text-[9px] text-muted-foreground/40">m</span>
                                    </div>
                                    <input value={manualDescription} onChange={(e) => setManualDescription(e.target.value)} placeholder="Note..."
                                        className="flex-1 h-7 text-[11px] px-2 rounded-md bg-card border border-border outline-none text-foreground placeholder:text-muted-foreground/30" />
                                    <Button size="sm" onClick={addManualEntry} className="h-7 px-2 text-[10px]"><Plus className="w-3 h-3" /></Button>
                                </div>
                            </div>

                            {/* Summary */}
                            {totalTrackedMinutes > 0 && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-base/5">
                                    <Timer className="w-3.5 h-3.5 text-accent-base" />
                                    <span className="text-[12px] text-foreground font-semibold">{totalTrackedDisplay}</span>
                                    <span className="text-[10px] text-muted-foreground/40">total</span>
                                </div>
                            )}

                            {/* Entries list */}
                            <div className="space-y-1">
                                {timeEntries.filter((e) => !e.is_running).map((entry) => (
                                    <div key={entry.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/3 transition-colors group">
                                        <Clock className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                                        <span className="text-[11px] font-medium text-foreground tabular-nums">
                                            {entry.duration_minutes ? `${Math.floor(entry.duration_minutes / 60)}h ${entry.duration_minutes % 60}m` : '—'}
                                        </span>
                                        {entry.description && (
                                            <span className="text-[10px] text-muted-foreground/50 truncate flex-1">{entry.description}</span>
                                        )}
                                        <span className="text-[9px] text-muted-foreground/25">{entry.is_manual ? 'manual' : 'timer'}</span>
                                        <button onClick={() => deleteTimeEntry(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-3 h-3 text-muted-foreground/30 hover:text-red-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ═══ APPROVALS TAB ═══ */}
                    {activeTab === 'approvals' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Request Approval</label>
                                <div className="flex items-center gap-2">
                                    <input value={approvalName} onChange={(e) => setApprovalName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') requestApproval(); }}
                                        placeholder="Approver name or agent..."
                                        className="flex-1 h-7 text-[11px] px-2 rounded-md bg-card border border-border outline-none text-foreground placeholder:text-muted-foreground/30" />
                                    <Button size="sm" onClick={requestApproval} disabled={!approvalName.trim()} className="h-7 px-3 text-[10px]">Request</Button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {approvals.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground/25 text-center py-4">No approvals requested yet</p>
                                ) : (
                                    approvals.map((appr) => (
                                        <div key={appr.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-foreground/2 border border-border/20">
                                            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                                                appr.approver_type === 'agent' ? "bg-accent-violet/10" : "bg-accent-ocean/10")}>
                                                {appr.approver_type === 'agent' ? <Bot className="w-3.5 h-3.5 text-accent-violet" /> : <User className="w-3.5 h-3.5 text-accent-ocean" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-medium text-foreground">{appr.approver_name}</p>
                                                <p className="text-[9px] text-muted-foreground/40">
                                                    {appr.status === 'pending' ? 'Awaiting response' : appr.status === 'approved' ? 'Approved' : 'Rejected'}
                                                    {appr.resolved_at && ` · ${new Date(appr.resolved_at).toLocaleDateString()}`}
                                                </p>
                                            </div>
                                            {appr.status === 'pending' ? (
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => resolveApproval(appr.id, 'approved')}
                                                        className="w-6 h-6 rounded-full bg-accent-lime/10 flex items-center justify-center text-accent-lime hover:bg-accent-lime/20 transition-colors">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => resolveApproval(appr.id, 'rejected')}
                                                        className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors">
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={cn("text-[9px] font-semibold px-2 py-0.5 rounded-full",
                                                    appr.status === 'approved' ? "bg-accent-lime/10 text-accent-lime" : "bg-red-500/10 text-red-400")}>
                                                    {appr.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* ── RIGHT COLUMN: Activity / Comments ── */}
                <div className="flex flex-col" style={{ width: 280, minWidth: 240 }}>
                    {/* Activity header */}
                    <div className="px-3 py-3 border-b border-border/20 flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/40" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">Activity</span>
                        {activities.length > 0 && (
                            <span className="text-[8px] bg-foreground/5 rounded-full w-4 h-4 flex items-center justify-center tabular-nums text-muted-foreground/40">{activities.length}</span>
                        )}
                    </div>

                    {/* Activity timeline */}
                    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-hide">
                        {activities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <MessageSquare className="w-5 h-5 text-muted-foreground/10" />
                                <p className="text-[10px] text-muted-foreground/20">No activity yet</p>
                            </div>
                        ) : (
                            activities.slice(0, 50).map((act) => (
                                <div key={act.id} className="flex gap-2">
                                    <div className="w-5 h-5 rounded-full bg-foreground/5 flex items-center justify-center shrink-0 mt-0.5">
                                        {act.source === 'agent' ? <Bot className="w-2.5 h-2.5 text-accent-violet" /> :
                                         act.source === 'system' ? <Clock className="w-2.5 h-2.5 text-muted-foreground" /> :
                                         <User className="w-2.5 h-2.5 text-accent-ocean" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-[10px] font-medium text-foreground">{act.source_name}</span>
                                            <span className="text-[8px] text-muted-foreground/25">
                                                {new Date(act.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        {act.action_type === 'comment' ? (
                                            <div className="mt-1 p-2 rounded-md bg-foreground/3 border border-border/20">
                                                <p className="text-[11px] text-foreground/80 leading-relaxed">{act.content}</p>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{act.content}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Comment input (sticky bottom) */}
                    <div className="border-t border-border/30 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                            <Input
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
                                placeholder="Add a comment..."
                                className="flex-1 h-8 text-[11px] rounded-lg border-border bg-card"
                            />
                            <Button
                                size="sm"
                                onClick={handleComment}
                                disabled={!comment.trim()}
                                className="w-8 h-8 p-0 rounded-lg bg-foreground text-background hover:bg-foreground/90"
                            >
                                <Send className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
