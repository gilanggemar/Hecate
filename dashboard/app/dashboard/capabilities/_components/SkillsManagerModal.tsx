'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Search, Sparkles, Plus, Upload, Github, Globe, FileText,
    MoreHorizontal, Pencil, Trash2, Tag, ArrowUpDown, FolderPlus,
    ChevronDown, ExternalLink, AlertTriangle, Check, Loader2
} from 'lucide-react';
import { useOpenClawCapabilitiesStore } from '@/stores/useOpenClawCapabilitiesStore';
import type { OpenClawSkill, SkillGroup } from '@/lib/openclaw/capabilities';
import { cn } from '@/lib/utils';
import { GatewayRestartDialog } from './GatewayRestartDialog';

// ─── Source Detection ────────────────────────────────────────────────────────

function detectSource(url: string): 'github' | 'skill.sh' | 'manual' {
    if (url.includes('github.com') || url.includes('raw.githubusercontent.com')) return 'github';
    if (url.includes('skill.sh')) return 'skill.sh';
    return 'manual';
}

function sourceIcon(source?: string) {
    switch (source) {
        case 'github': return <Github className="size-3" />;
        case 'skill.sh': return <Globe className="size-3" />;
        case 'manual': return <Upload className="size-3" />;
        default: return <FileText className="size-3" />;
    }
}

function sourceLabel(source?: string) {
    switch (source) {
        case 'github': return 'GitHub';
        case 'skill.sh': return 'skill.sh';
        case 'manual': return 'Manual Upload';
        default: return 'Inherited';
    }
}

// ─── Sort Options ────────────────────────────────────────────────────────────

type SortKey = 'name' | 'source' | 'status';

function sortSkills(skills: OpenClawSkill[], sortBy: SortKey): OpenClawSkill[] {
    return [...skills].sort((a, b) => {
        switch (sortBy) {
            case 'name': return a.name.localeCompare(b.name);
            case 'source': return (a.source || '').localeCompare(b.source || '');
            case 'status': return (a.enabled === b.enabled) ? 0 : a.enabled ? -1 : 1;
            default: return 0;
        }
    });
}

// ─── Skill Row Component ─────────────────────────────────────────────────────

interface SkillRowProps {
    skill: OpenClawSkill;
    isToggling: boolean;
    onToggle: (enabled: boolean) => void;
    onRename: () => void;
    onDelete: () => void;
    onManageTags: () => void;
}

function SkillRow({ skill, isToggling, onToggle, onRename, onDelete, onManageTags }: SkillRowProps) {
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
                'group flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                'hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]',
                skill.inherited && 'opacity-60'
            )}
        >
            {/* Eligibility Dot */}
            <div className={cn(
                'shrink-0 size-2 rounded-full',
                skill.eligible ? 'bg-emerald-400/80' : 'bg-amber-400/80'
            )} />

            {/* Skill Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white/85 truncate">{skill.name}</span>
                    {skill.inherited && (
                        <span className="shrink-0 text-[9px] font-mono uppercase tracking-wider text-white/25 bg-white/5 px-1.5 py-0.5 rounded-md">
                            inherited
                        </span>
                    )}
                </div>
                {skill.description && (
                    <p className="mt-0.5 text-[11px] font-mono text-white/30 truncate">
                        {skill.description}
                    </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                    {/* Source Badge */}
                    <span className={cn(
                        'flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-md',
                        skill.source === 'github' && 'text-sky-400/60 bg-sky-500/8',
                        skill.source === 'skill.sh' && 'text-purple-400/60 bg-purple-500/8',
                        skill.source === 'manual' && 'text-amber-400/60 bg-amber-500/8',
                        (!skill.source || skill.source === 'inherited') && 'text-white/25 bg-white/5'
                    )}>
                        {sourceIcon(skill.source)}
                        {sourceLabel(skill.source)}
                    </span>
                    {/* Tags */}
                    {skill.tags && skill.tags.length > 0 && skill.tags.map(tag => (
                        <span key={tag} className="text-[9px] font-mono text-violet-400/50 bg-violet-500/8 px-1.5 py-0.5 rounded-md">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* Toggle */}
            <button
                onClick={() => onToggle(!skill.enabled)}
                disabled={isToggling}
                className={cn(
                    'relative shrink-0 w-9 h-5 rounded-full transition-all duration-200',
                    isToggling && 'opacity-40 cursor-not-allowed',
                    skill.enabled
                        ? 'bg-emerald-500/30 border border-emerald-500/40'
                        : 'bg-white/5 border border-white/10'
                )}
            >
                <div className={cn(
                    'absolute top-0.5 size-4 rounded-full transition-all duration-200',
                    skill.enabled
                        ? 'left-[18px] bg-emerald-400'
                        : 'left-0.5 bg-white/30'
                )} />
            </button>

            {/* Action Menu */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
                >
                    <MoreHorizontal className="size-4" />
                </button>
                <AnimatePresence>
                    {showMenu && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl bg-[#0c0c0b] border border-white/10 shadow-2xl overflow-hidden"
                            onMouseLeave={() => setShowMenu(false)}
                        >
                            <button onClick={() => { onRename(); setShowMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-mono text-white/60 hover:bg-white/5 hover:text-white/90 transition-all">
                                <Pencil className="size-3.5" /> Rename
                            </button>
                            <button onClick={() => { onManageTags(); setShowMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-mono text-white/60 hover:bg-white/5 hover:text-white/90 transition-all">
                                <Tag className="size-3.5" /> Manage Tags
                            </button>
                            {skill.sourceUrl && (
                                <a href={skill.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-mono text-white/60 hover:bg-white/5 hover:text-white/90 transition-all">
                                    <ExternalLink className="size-3.5" /> View Source
                                </a>
                            )}
                            <div className="border-t border-white/5" />
                            <button onClick={() => { onDelete(); setShowMenu(false); }} className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-mono text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all">
                                <Trash2 className="size-3.5" /> Delete
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ─── Install Panel ───────────────────────────────────────────────────────────

function InstallPanel({ onClose }: { onClose: () => void }) {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const installSkill = useOpenClawCapabilitiesStore(s => s.installSkill);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleUrlInstall = async () => {
        if (!url.trim()) return;
        setIsLoading(true);
        setError(null);

        try {
            const source = detectSource(url);
            let fetchUrl = url;

            // Convert GitHub repo URL to raw content
            if (source === 'github') {
                fetchUrl = url
                    .replace('github.com', 'raw.githubusercontent.com')
                    .replace('/blob/', '/');
            }

            const res = await fetch('/api/skill-fetch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: fetchUrl }),
            });

            if (!res.ok) throw new Error(`Failed to fetch skill: ${res.statusText}`);
            const data = await res.json();

            // Derive key from URL or filename
            const urlParts = url.split('/').filter(Boolean);
            const key = urlParts[urlParts.length - 1]?.replace(/\.(md|txt|zip)$/i, '') || `skill-${Date.now()}`;
            const name = key.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Check if skill is non-OpenClaw (e.g. mentions Claude, Anthropic, etc.)
            const isNonOpenClaw = /claude|anthropic|cursor|windsurf|copilot/i.test(data.content || '');
            const compatibilityNote = isNonOpenClaw
                ? `This skill was originally authored for a different AI assistant. The OpenClaw agent should adapt its instructions to work within the OpenClaw framework.`
                : undefined;

            installSkill({
                key,
                name,
                description: data.description || `Installed from ${sourceLabel(source)}`,
                source,
                sourceUrl: url,
                content: data.content,
                compatibilityNote,
            });

            setUrl('');
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to install skill');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileDrop = async (files: FileList) => {
        const file = files[0];
        if (!file) return;
        setIsLoading(true);
        setError(null);

        try {
            const content = await file.text();
            const key = file.name.replace(/\.(md|txt|zip)$/i, '').replace(/\s+/g, '-').toLowerCase();
            const name = key.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            const isNonOpenClaw = /claude|anthropic|cursor|windsurf|copilot/i.test(content);

            installSkill({
                key,
                name,
                description: `Manually uploaded from ${file.name}`,
                source: 'manual',
                content,
                compatibilityNote: isNonOpenClaw
                    ? `This skill was originally authored for a different AI assistant. The OpenClaw agent should adapt its instructions to work within the OpenClaw framework.`
                    : undefined,
            });

            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to read file');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
        >
            <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Install New Skill</h4>
                    <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
                        <X className="size-3.5" />
                    </button>
                </div>

                {/* URL Input */}
                <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                        <Globe className="size-3.5 text-white/25 shrink-0" />
                        <input
                            type="text"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleUrlInstall()}
                            placeholder="Paste GitHub URL, skill.sh link, or any skill source..."
                            className="flex-1 bg-transparent text-xs font-mono text-white/80 placeholder:text-white/20 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleUrlInstall}
                        disabled={isLoading || !url.trim()}
                        className="px-4 py-2 rounded-lg text-xs font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                        Install
                    </button>
                </div>

                {/* Drag & Drop Zone */}
                <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFileDrop(e.dataTransfer.files); }}
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                        'flex flex-col items-center justify-center py-6 rounded-xl border border-dashed cursor-pointer transition-all',
                        dragOver
                            ? 'border-orange-500/40 bg-orange-500/5'
                            : 'border-white/[0.08] bg-white/[0.01] hover:border-white/[0.15] hover:bg-white/[0.02]'
                    )}
                >
                    <Upload className={cn('size-5 mb-2', dragOver ? 'text-orange-400/70' : 'text-white/20')} />
                    <p className="text-[11px] font-mono text-white/30">
                        Drop a <span className="text-white/50">.md</span> or <span className="text-white/50">.zip</span> file here, or click to browse
                    </p>
                    <input ref={fileRef} type="file" accept=".md,.txt,.zip" className="hidden" onChange={e => e.target.files && handleFileDrop(e.target.files)} />
                </div>

                {error && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5">
                        <AlertTriangle className="size-3.5 text-red-400/60" />
                        <p className="text-xs font-mono text-red-400/70">{error}</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ─── Rename Dialog ───────────────────────────────────────────────────────────

function RenameDialog({ currentName, onConfirm, onCancel }: { currentName: string; onConfirm: (name: string) => void; onCancel: () => void }) {
    const [name, setName] = useState(currentName);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl bg-[#0c0c0b] border border-white/10 p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-sm font-semibold text-white/90 mb-4">Rename Skill</h3>
                <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onConfirm(name)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono text-white/80 outline-none focus:border-orange-500/30"
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-mono text-white/50 hover:bg-white/5 transition-all">Cancel</button>
                    <button onClick={() => onConfirm(name)} className="px-3 py-1.5 rounded-lg text-xs font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all">Rename</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Tag Manager Dialog ──────────────────────────────────────────────────────

function TagManagerDialog({ skillKey, currentTags, groups, onConfirm, onCancel }: {
    skillKey: string;
    currentTags: string[];
    groups: SkillGroup[];
    onConfirm: (tags: string[]) => void;
    onCancel: () => void;
}) {
    const [selectedTags, setSelectedTags] = useState<string[]>(currentTags);

    const toggleTag = (groupName: string) => {
        setSelectedTags(prev =>
            prev.includes(groupName) ? prev.filter(t => t !== groupName) : [...prev, groupName]
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl bg-[#0c0c0b] border border-white/10 p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <h3 className="text-sm font-semibold text-white/90 mb-4">Manage Tags</h3>
                {groups.length === 0 ? (
                    <p className="text-xs font-mono text-white/30 py-4 text-center">No groups created yet. Create a group first.</p>
                ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {groups.map(g => (
                            <button
                                key={g.id}
                                onClick={() => toggleTag(g.name)}
                                className={cn(
                                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-mono transition-all',
                                    selectedTags.includes(g.name)
                                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                        : 'text-white/50 hover:bg-white/5 border border-transparent'
                                )}
                            >
                                {selectedTags.includes(g.name) ? <Check className="size-3.5" /> : <Tag className="size-3.5 opacity-30" />}
                                {g.name}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-mono text-white/50 hover:bg-white/5 transition-all">Cancel</button>
                    <button onClick={() => onConfirm(selectedTags)} className="px-3 py-1.5 rounded-lg text-xs font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all">Apply</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

interface SkillsManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    skills: OpenClawSkill[];
    togglingItems: Set<string>;
    onToggle: (skillKey: string, enabled: boolean) => void;
    activeTab: 'per-agent' | 'global' | 'core-files';
    selectedAgentId: string | null;
}

export function SkillsManagerModal({
    isOpen,
    onClose,
    skills,
    togglingItems,
    onToggle,
    activeTab,
    selectedAgentId,
}: SkillsManagerModalProps) {
    const {
        skillGroups,
        hasUnsavedChanges,
        isApplying,
        deleteSkill,
        renameSkill,
        setSkillTags,
        createSkillGroup,
        renameSkillGroup,
        deleteSkillGroup,
        applyChanges,
        discardChanges,
    } = useOpenClawCapabilitiesStore();

    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<SortKey>('name');
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [showInstall, setShowInstall] = useState(false);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [renameTarget, setRenameTarget] = useState<OpenClawSkill | null>(null);
    const [tagTarget, setTagTarget] = useState<OpenClawSkill | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState('');
    const [showRestartDialog, setShowRestartDialog] = useState(false);

    // Filter + sort skills
    const displaySkills = useMemo(() => {
        let filtered = skills;

        // Group filter
        if (selectedGroup) {
            filtered = filtered.filter(s => s.tags?.includes(selectedGroup));
        }

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.key.toLowerCase().includes(q) ||
                s.description?.toLowerCase().includes(q)
            );
        }

        return sortSkills(filtered, sortBy);
    }, [skills, search, sortBy, selectedGroup]);

    const enabledCount = skills.filter(s => s.enabled).length;
    const eligibleCount = skills.filter(s => s.eligible).length;

    const handleConfirm = () => {
        setShowRestartDialog(true);
    };

    const handleRestartConfirmed = async () => {
        setShowRestartDialog(false);
        await applyChanges();
    };

    if (!isOpen) return null;

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex flex-col bg-[#080706]"
            >
                {/* ═══ HEADER ═══ */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-3">
                        <Sparkles className="size-5 text-violet-400/70" />
                        <div>
                            <h2 className="text-base font-bold text-white/95 tracking-tight">Skills Manager</h2>
                            <p className="text-[11px] font-mono text-white/30 mt-0.5">
                                {enabledCount}/{skills.length} enabled · {eligibleCount} eligible
                                {activeTab === 'per-agent' && selectedAgentId && (
                                    <span className="text-orange-400/50 ml-2">· Agent: {selectedAgentId}</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasUnsavedChanges && (
                            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                                <button onClick={discardChanges} disabled={isApplying} className="px-3 py-1.5 rounded-lg text-xs font-mono bg-transparent text-white/50 border border-white/10 hover:bg-white/5 hover:text-white/80 transition-all disabled:opacity-50">
                                    Discard
                                </button>
                                <button onClick={handleConfirm} disabled={isApplying} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)] disabled:opacity-50">
                                    {isApplying ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                    {isApplying ? 'Applying...' : 'Confirm Changes'}
                                </button>
                            </motion.div>
                        )}
                        <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
                            <X className="size-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* ═══ LEFT SIDEBAR — Groups ═══ */}
                    <div className="w-56 border-r border-white/[0.06] flex flex-col">
                        <div className="px-3 py-3 border-b border-white/[0.04]">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-white/25 mb-2">Groups</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                            {/* All Skills */}
                            <button
                                onClick={() => setSelectedGroup(null)}
                                className={cn(
                                    'w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all',
                                    !selectedGroup
                                        ? 'bg-white/[0.06] text-white/80'
                                        : 'text-white/40 hover:bg-white/[0.03] hover:text-white/60'
                                )}
                            >
                                All Skills <span className="text-white/20 ml-1">({skills.length})</span>
                            </button>

                            {/* Custom Groups */}
                            {skillGroups.map(g => (
                                <div key={g.id} className="group flex items-center">
                                    {editingGroupId === g.id ? (
                                        <input
                                            autoFocus
                                            value={editingGroupName}
                                            onChange={e => setEditingGroupName(e.target.value)}
                                            onBlur={() => { renameSkillGroup(g.id, editingGroupName); setEditingGroupId(null); }}
                                            onKeyDown={e => { if (e.key === 'Enter') { renameSkillGroup(g.id, editingGroupName); setEditingGroupId(null); } }}
                                            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/80 outline-none"
                                        />
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setSelectedGroup(g.name)}
                                                className={cn(
                                                    'flex-1 text-left px-3 py-2 rounded-lg text-xs font-mono transition-all truncate',
                                                    selectedGroup === g.name
                                                        ? 'bg-violet-500/10 text-violet-400'
                                                        : 'text-white/40 hover:bg-white/[0.03] hover:text-white/60'
                                                )}
                                            >
                                                {g.name}
                                                <span className="text-white/15 ml-1">
                                                    ({skills.filter(s => s.tags?.includes(g.name)).length})
                                                </span>
                                            </button>
                                            <div className="hidden group-hover:flex items-center gap-0.5 mr-1">
                                                <button
                                                    onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); }}
                                                    className="p-1 rounded text-white/20 hover:text-white/50 transition-colors"
                                                >
                                                    <Pencil className="size-2.5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteSkillGroup(g.id)}
                                                    className="p-1 rounded text-white/20 hover:text-red-400/60 transition-colors"
                                                >
                                                    <Trash2 className="size-2.5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}

                            {/* Add Group */}
                            {showNewGroup ? (
                                <div className="flex gap-1">
                                    <input
                                        autoFocus
                                        value={newGroupName}
                                        onChange={e => setNewGroupName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && newGroupName.trim()) { createSkillGroup(newGroupName.trim()); setNewGroupName(''); setShowNewGroup(false); } if (e.key === 'Escape') setShowNewGroup(false); }}
                                        placeholder="Group name..."
                                        className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-white/80 outline-none placeholder:text-white/20"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowNewGroup(true)}
                                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-mono text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all"
                                >
                                    <FolderPlus className="size-3" /> New Group
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ═══ MAIN CONTENT ═══ */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Toolbar */}
                        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.04]">
                            {/* Search */}
                            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                <Search className="size-3.5 text-white/25" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search skills..."
                                    className="flex-1 bg-transparent text-xs font-mono text-white/80 placeholder:text-white/20 outline-none"
                                />
                            </div>

                            {/* Sort */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowSortMenu(!showSortMenu)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all"
                                >
                                    <ArrowUpDown className="size-3" />
                                    Sort: {sortBy}
                                    <ChevronDown className="size-3" />
                                </button>
                                <AnimatePresence>
                                    {showSortMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -4 }}
                                            className="absolute right-0 top-full mt-1 z-50 w-36 rounded-xl bg-[#0c0c0b] border border-white/10 shadow-2xl overflow-hidden"
                                            onMouseLeave={() => setShowSortMenu(false)}
                                        >
                                            {(['name', 'source', 'status'] as SortKey[]).map(key => (
                                                <button
                                                    key={key}
                                                    onClick={() => { setSortBy(key); setShowSortMenu(false); }}
                                                    className={cn(
                                                        'w-full px-3 py-2 text-xs font-mono text-left transition-all',
                                                        sortBy === key ? 'text-orange-400 bg-orange-500/5' : 'text-white/50 hover:bg-white/5'
                                                    )}
                                                >
                                                    {key.charAt(0).toUpperCase() + key.slice(1)}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Install Button */}
                            <button
                                onClick={() => setShowInstall(!showInstall)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                                    showInstall
                                        ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20'
                                )}
                            >
                                <Plus className="size-3" />
                                Install Skill
                            </button>
                        </div>

                        {/* Install Panel */}
                        <AnimatePresence>
                            {showInstall && (
                                <div className="px-5 pt-3">
                                    <InstallPanel onClose={() => setShowInstall(false)} />
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Skills List */}
                        <div className="flex-1 overflow-y-auto px-5 py-2 scrollbar-thin">
                            <AnimatePresence mode="popLayout">
                                {displaySkills.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex flex-col items-center justify-center py-20"
                                    >
                                        <Sparkles className="size-8 text-white/10 mb-3" />
                                        <p className="text-xs font-mono text-white/30">
                                            {search ? 'No skills match your search' : selectedGroup ? 'No skills in this group' : 'No skills configured'}
                                        </p>
                                    </motion.div>
                                ) : (
                                    displaySkills.map(skill => (
                                        <SkillRow
                                            key={skill.key}
                                            skill={skill}
                                            isToggling={
                                                togglingItems.has(`global-skill-${skill.key}`) ||
                                                togglingItems.has(`agent-skill-${skill.key}`)
                                            }
                                            onToggle={(enabled) => onToggle(skill.key, enabled)}
                                            onRename={() => setRenameTarget(skill)}
                                            onDelete={() => deleteSkill(skill.key)}
                                            onManageTags={() => setTagTarget(skill)}
                                        />
                                    ))
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        {hasUnsavedChanges && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="px-5 py-3 border-t border-amber-500/10 bg-amber-500/[0.03]"
                            >
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="size-3.5 text-amber-400/50" />
                                    <p className="text-[11px] font-mono text-amber-400/60">
                                        You have unsaved changes. Click <span className="text-amber-400/90">Confirm Changes</span> to apply and restart the gateway.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Sub-dialogs */}
            <AnimatePresence>
                {renameTarget && (
                    <RenameDialog
                        currentName={renameTarget.name}
                        onConfirm={(name) => { renameSkill(renameTarget.key, name); setRenameTarget(null); }}
                        onCancel={() => setRenameTarget(null)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {tagTarget && (
                    <TagManagerDialog
                        skillKey={tagTarget.key}
                        currentTags={tagTarget.tags || []}
                        groups={skillGroups}
                        onConfirm={(tags) => { setSkillTags(tagTarget.key, tags); setTagTarget(null); }}
                        onCancel={() => setTagTarget(null)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showRestartDialog && (
                    <GatewayRestartDialog
                        onConfirm={handleRestartConfirmed}
                        onCancel={() => setShowRestartDialog(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
