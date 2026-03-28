"use client";

import { useSocket, useSocketStore } from "@/lib/useSocket";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
    Settings, Save, RotateCcw, Shield, Bell,
    Cpu, Wifi, AlertTriangle, Server, Eye,
    ChevronDown, X, Plus, FolderCode, Tag, Search, Heart
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import ConnectionProfiles from "@/components/settings/ConnectionProfiles";
import { useRouter } from "next/navigation";

import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";
import { useOpenClawCapabilitiesStore } from "@/stores/useOpenClawCapabilitiesStore";
import { useOpenClawModelStore } from "@/stores/useOpenClawModelStore";
import { useOpenClawStore } from "@/store/useOpenClawStore";
import { getAgentProfile } from "@/lib/agentRoster";
import { AnimatePresence, motion } from "framer-motion";

export default function SettingsPage() {
    const { agents, isConnected } = useSocketStore();
    const { sendConfigUpdate } = useSocket();
    const { hiddenAgentIds, setAgentVisibility, agentTags, addTagToAgent, removeTagFromAgent } = useAgentSettingsStore();
    const router = useRouter();
    const setActiveTab = useOpenClawCapabilitiesStore(s => s.setActiveTab);
    const setTargetAgent = useOpenClawCapabilitiesStore(s => s.setSelectedAgentId);

    // Model store
    const openClawConnected = useOpenClawStore(s => s.isConnected);
    const {
        activeModels,
        activeHeartbeatModels,
        defaultModel,
        defaultHeartbeatModel,
        modelCatalog,
        isModelLoading,
        fetchModels,
        bufferModelChange,
        bufferHeartbeatModelChange,
    } = useOpenClawModelStore();

    const [autoRestart, setAutoRestart] = useState(true);
    const [notifyOnError, setNotifyOnError] = useState(true);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    // Track which agent panels are expanded
    const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
    // Track new-tag input per agent
    const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
    // Track which agent model dropdowns are open
    const [openModelDropdown, setOpenModelDropdown] = useState<string | null>(null);
    const [modelSearch, setModelSearch] = useState('');

    // Fetch models on mount
    useEffect(() => {
        if (openClawConnected && modelCatalog.length === 0 && !isModelLoading) {
            fetchModels();
        }
    }, [openClawConnected, modelCatalog.length, isModelLoading, fetchModels]);

    const toggleExpanded = (id: string) => {
        setExpandedAgents(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSave = useCallback(() => {
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(null), 2000);
    }, []);

    const handleEmergencyShutdown = () => {
        if (!window.confirm("⚠ This will terminate all active agents. Continue?")) return;
        agents.forEach((agent: any) => {
            const id = agent.accountId || agent.name || agent.id;
            sendConfigUpdate(id, { shutdown: true });
        });
    };

    const handleAddTag = (agentId: string) => {
        const val = (tagInputs[agentId] || "").trim();
        if (!val) return;
        addTagToAgent(agentId, val);
        setTagInputs(prev => ({ ...prev, [agentId]: "" }));
    };

    const handleCoreFiles = (agentId: string) => {
        setActiveTab('core-files');
        setTargetAgent(agentId);
        router.push('/dashboard/capabilities');
    };

    // Tag color palette — elegant, non-cyberpunk pastel/modern colors
    const TAG_COLORS = [
        { bg: 'rgba(167,139,250,0.15)', text: '#c4b5fd', border: 'rgba(167,139,250,0.3)' },
        { bg: 'rgba(52,211,153,0.15)', text: '#6ee7b7', border: 'rgba(52,211,153,0.3)' },
        { bg: 'rgba(251,146,60,0.15)', text: '#fdba74', border: 'rgba(251,146,60,0.3)' },
        { bg: 'rgba(56,189,248,0.15)', text: '#7dd3fc', border: 'rgba(56,189,248,0.3)' },
        { bg: 'rgba(251,113,133,0.15)', text: '#fda4af', border: 'rgba(251,113,133,0.3)' },
        { bg: 'rgba(163,230,53,0.15)', text: '#bef264', border: 'rgba(163,230,53,0.3)' },
        { bg: 'rgba(232,121,249,0.15)', text: '#e879f9', border: 'rgba(232,121,249,0.3)' },
        { bg: 'rgba(253,224,71,0.15)', text: '#fde047', border: 'rgba(253,224,71,0.3)' },
    ];

    const getTagColor = (tag: string) => {
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
    };

    return (
        <div className="flex flex-col h-full gap-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
                <div className="flex items-center gap-2">
                    {saveStatus && (
                        <span className="text-xs text-emerald-500 animate-pulse">{saveStatus}</span>
                    )}
                    <Button
                        onClick={handleSave}
                        size="sm"
                        className="rounded-full h-9 px-5 text-xs bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 gap-2"
                    >
                        <Save className="w-3 h-3" />
                        Save Changes
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="space-y-6 pb-6">

                    {/* Connection Profiles */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Server className="w-3.5 h-3.5" /> Connection Profiles
                        </h2>
                        <ConnectionProfiles />
                    </section>

                    <Separator className="bg-border" />

                    {/* Agent Preferences (replaces old Agent Configuration + Displayed Agents) */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5" /> Agent Preferences
                        </h2>

                        <Card className="rounded-xl border-border bg-card shadow-none py-0 gap-0">
                            <CardContent className="p-0">
                                {agents.length === 0 ? (
                                    <div className="p-4">
                                        <p className="text-xs text-muted-foreground">No agents available.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {agents.map((a: any) => {
                                            const id = a.accountId || a.name || a.id;
                                            const label = a.accountId
                                                ? a.accountId.charAt(0).toUpperCase() + a.accountId.slice(1)
                                                : a.name || a.id;
                                            const isHidden = hiddenAgentIds.includes(id);
                                            const isExpanded = expandedAgents[id] || false;
                                            const tags = agentTags[id] || [];
                                            const profile = getAgentProfile(id);
                                            const colorHex = profile?.colorHex || '#FF6D29';

                                            return (
                                                <div key={id} className="group">
                                                    {/* Agent Row — clickable to expand */}
                                                    <div
                                                        className={cn(
                                                            "flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors duration-200",
                                                            isExpanded ? "bg-muted/30" : "hover:bg-muted/20"
                                                        )}
                                                        onClick={() => toggleExpanded(id)}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            {/* Color dot */}
                                                            <div
                                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: colorHex }}
                                                            />
                                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                                <p className="text-[13px] font-medium text-foreground truncate">{label}</p>
                                                                {tags.length > 0 && (
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        {tags.slice(0, 3).map((tag) => {
                                                                            const c = getTagColor(tag);
                                                                            return (
                                                                                <span
                                                                                    key={tag}
                                                                                    className="text-[9px] font-medium px-1.5 py-0.5 rounded-md leading-none"
                                                                                    style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                                                                                >
                                                                                    {tag}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                        {tags.length > 3 && (
                                                                            <span className="text-[9px] text-muted-foreground">+{tags.length - 3}</span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            {/* Show/Hide Toggle */}
                                                            <div
                                                                className="flex items-center gap-2"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {isHidden ? 'Hidden' : 'Visible'}
                                                                </span>
                                                                <Switch
                                                                    checked={!isHidden}
                                                                    onCheckedChange={(checked) => setAgentVisibility(id, !checked)}
                                                                />
                                                            </div>
                                                            {/* Chevron */}
                                                            <ChevronDown
                                                                className={cn(
                                                                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                                                                    isExpanded && "rotate-180"
                                                                )}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Expanded Preferences Panel */}
                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="px-4 pb-4 pt-1 space-y-4 bg-muted/10">

                                                                    {/* Tags Section */}
                                                                    <div className="space-y-2.5">
                                                                        <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                                                            <Tag className="w-3 h-3" /> Custom Tags
                                                                        </label>

                                                                        {/* Existing Tags */}
                                                                        {tags.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {tags.map((tag) => {
                                                                                    const c = getTagColor(tag);
                                                                                    return (
                                                                                        <span
                                                                                            key={tag}
                                                                                            className="inline-flex items-center gap-1 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-lg transition-all duration-200 hover:scale-105"
                                                                                            style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                                                                                        >
                                                                                            {tag}
                                                                                            <button
                                                                                                onClick={() => removeTagFromAgent(id, tag)}
                                                                                                className="ml-0.5 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                                                                                            >
                                                                                                <X className="w-3 h-3" />
                                                                                            </button>
                                                                                        </span>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}

                                                                        {/* Add Tag Input */}
                                                                        <div className="flex gap-2">
                                                                            <Input
                                                                                value={tagInputs[id] || ""}
                                                                                onChange={(e) => setTagInputs(prev => ({ ...prev, [id]: e.target.value }))}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === 'Enter') {
                                                                                        e.preventDefault();
                                                                                        handleAddTag(id);
                                                                                    }
                                                                                }}
                                                                                placeholder="Add a tag (e.g. Coder, Designer...)"
                                                                                className="h-8 text-[12px] rounded-lg border-border bg-background flex-1"
                                                                            />
                                                                            <Button
                                                                                onClick={() => handleAddTag(id)}
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-8 px-3 rounded-lg text-[11px] border-border gap-1"
                                                                            >
                                                                                <Plus className="w-3 h-3" />
                                                                                Add
                                                                            </Button>
                                                                        </div>
                                                                    </div>

                                                                    <Separator className="bg-border/50" />

                                                                    {/* Model Selectors */}
                                                                    <div className="space-y-3">
                                                                        {/* Primary Model */}
                                                                        <SettingsModelDropdown
                                                                            label="Primary Model"
                                                                            icon={<Cpu className="w-3 h-3" />}
                                                                            agentId={id}
                                                                            currentModel={activeModels[id] ?? defaultModel ?? ''}
                                                                            modelCatalog={modelCatalog}
                                                                            colorHex={colorHex}
                                                                            isOpen={openModelDropdown === `${id}-primary`}
                                                                            onToggle={() => {
                                                                                setOpenModelDropdown(openModelDropdown === `${id}-primary` ? null : `${id}-primary`);
                                                                                setModelSearch('');
                                                                            }}
                                                                            onClose={() => { setOpenModelDropdown(null); setModelSearch(''); }}
                                                                            search={openModelDropdown === `${id}-primary` ? modelSearch : ''}
                                                                            onSearchChange={setModelSearch}
                                                                            onSelect={(ref) => {
                                                                                const isDefault = !activeModels[id] || activeModels[id] === defaultModel;
                                                                                bufferModelChange(id, ref, isDefault);
                                                                                setOpenModelDropdown(null);
                                                                                setModelSearch('');
                                                                            }}
                                                                            isConnected={openClawConnected}
                                                                        />

                                                                        {/* Heartbeat Model */}
                                                                        <SettingsModelDropdown
                                                                            label="Heartbeat Model"
                                                                            icon={<Heart className="w-3 h-3" />}
                                                                            agentId={id}
                                                                            currentModel={activeHeartbeatModels[id] ?? defaultHeartbeatModel ?? ''}
                                                                            modelCatalog={modelCatalog}
                                                                            colorHex={colorHex}
                                                                            isOpen={openModelDropdown === `${id}-heartbeat`}
                                                                            onToggle={() => {
                                                                                setOpenModelDropdown(openModelDropdown === `${id}-heartbeat` ? null : `${id}-heartbeat`);
                                                                                setModelSearch('');
                                                                            }}
                                                                            onClose={() => { setOpenModelDropdown(null); setModelSearch(''); }}
                                                                            search={openModelDropdown === `${id}-heartbeat` ? modelSearch : ''}
                                                                            onSearchChange={setModelSearch}
                                                                            onSelect={(ref) => {
                                                                                const isDefault = !activeHeartbeatModels[id] || activeHeartbeatModels[id] === defaultHeartbeatModel;
                                                                                bufferHeartbeatModelChange(id, ref, isDefault);
                                                                                setOpenModelDropdown(null);
                                                                                setModelSearch('');
                                                                            }}
                                                                            isConnected={openClawConnected}
                                                                        />
                                                                    </div>

                                                                    <Separator className="bg-border/50" />

                                                                    {/* Core Files Button */}
                                                                    <Button
                                                                        onClick={() => handleCoreFiles(id)}
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full h-9 rounded-lg text-[11px] border-border gap-2 justify-center hover:bg-muted/40"
                                                                    >
                                                                        <FolderCode className="w-3.5 h-3.5" />
                                                                        View Capabilities & Core Files
                                                                    </Button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <Separator className="bg-border" />

                    {/* Preferences */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Settings className="w-3.5 h-3.5" /> Preferences
                        </h2>

                        <Card className="rounded-xl border-border bg-card shadow-none py-0 gap-0">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium text-foreground">Auto-Restart Agents</p>
                                        <p className="text-[11px] text-muted-foreground">Automatically restart agents after crash</p>
                                    </div>
                                    <Switch checked={autoRestart} onCheckedChange={setAutoRestart} />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium text-foreground">Error Notifications</p>
                                        <p className="text-[11px] text-muted-foreground">Get notified when agents encounter errors</p>
                                    </div>
                                    <Switch checked={notifyOnError} onCheckedChange={setNotifyOnError} />
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <Separator className="bg-border" />

                    {/* Danger Zone */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5" /> Danger Zone
                        </h2>

                        <Card className="rounded-xl border-red-500/20 bg-red-500/5 shadow-none py-0 gap-0">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3 h-3" /> Emergency Shutdown
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">Terminate all active agents immediately</p>
                                    </div>
                                    <Button
                                        onClick={handleEmergencyShutdown}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full h-8 px-4 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                                    >
                                        Shutdown All
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </ScrollArea>
        </div>
    );
}

// ─── Inline Model Dropdown for Settings (Portal-based) ──────────────────
interface SettingsModelDropdownProps {
    label: string;
    icon: React.ReactNode;
    agentId: string;
    currentModel: string;
    modelCatalog: { ref: string; alias?: string; provider: string; modelName: string }[];
    colorHex: string;
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    search: string;
    onSearchChange: (val: string) => void;
    onSelect: (ref: string) => void;
    isConnected: boolean;
}

function SettingsModelDropdown({
    label, icon, agentId, currentModel, modelCatalog, colorHex,
    isOpen, onToggle, onClose, search, onSearchChange, onSelect, isConnected
}: SettingsModelDropdownProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    const parts = currentModel ? (() => {
        const idx = currentModel.indexOf('/');
        if (idx > -1) return { provider: currentModel.substring(0, idx), name: currentModel.substring(idx + 1) };
        return { provider: '', name: currentModel };
    })() : null;

    const filtered = search.trim()
        ? modelCatalog.filter(m =>
            m.ref.toLowerCase().includes(search.toLowerCase()) ||
            (m.alias && m.alias.toLowerCase().includes(search.toLowerCase())) ||
            m.provider.toLowerCase().includes(search.toLowerCase()) ||
            m.modelName.toLowerCase().includes(search.toLowerCase())
        )
        : modelCatalog;

    // Position the portal dropdown based on trigger rect
    const updatePos = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            updatePos();
            window.addEventListener('scroll', updatePos, true);
            window.addEventListener('resize', updatePos);
            return () => {
                window.removeEventListener('scroll', updatePos, true);
                window.removeEventListener('resize', updatePos);
            };
        }
    }, [isOpen, updatePos]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        function handleClick(e: MouseEvent) {
            const target = e.target as Node;
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onClose]);

    const portal = isOpen && typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
                <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="fixed z-[9999] rounded-lg border border-border bg-popover shadow-2xl overflow-hidden"
                    style={{ top: pos.top, left: pos.left, width: pos.width }}
                >
                    {/* Search */}
                    <div className="p-2 border-b border-border">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
                            <Search size={12} className="text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                placeholder="Search models..."
                                autoFocus
                                className="bg-transparent outline-none text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 w-full"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-48 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">
                                No models found
                            </div>
                        ) : (
                            filtered.map((model) => {
                                const isActive = model.ref === currentModel;
                                return (
                                    <button
                                        key={model.ref}
                                        onClick={() => onSelect(model.ref)}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-mono",
                                            "hover:bg-muted/40 transition-colors",
                                            isActive && "bg-muted/30"
                                        )}
                                    >
                                        <span className={cn(
                                            "size-1.5 rounded-full shrink-0",
                                            isActive ? "bg-foreground" : "bg-muted-foreground/30"
                                        )} />
                                        <span className="flex flex-col min-w-0">
                                            <span className="flex items-center gap-0.5 truncate">
                                                <span className="text-muted-foreground">{model.provider}/</span>
                                                <span className={isActive ? 'text-foreground font-semibold' : 'text-foreground/80'}>
                                                    {model.modelName}
                                                </span>
                                            </span>
                                            {model.alias && (
                                                <span className="text-[10px] text-muted-foreground truncate">
                                                    {model.alias}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>,
            document.body
        )
        : null;

    return (
        <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                {icon} {label}
            </label>
            <div className="relative">
                <button
                    ref={triggerRef}
                    onClick={onToggle}
                    disabled={!isConnected}
                    className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[12px] font-mono transition-all",
                        "border bg-background hover:bg-muted/30",
                        isOpen ? "border-border ring-1 ring-white/10" : "border-border",
                        !isConnected && "opacity-40 cursor-not-allowed"
                    )}
                >
                    <span className="flex items-center gap-1.5 min-w-0 truncate">
                        <Cpu size={12} style={{ color: colorHex }} className="shrink-0" />
                        {parts ? (
                            <span className="truncate">
                                <span className="text-muted-foreground">{parts.provider}/</span>
                                <span className="text-foreground">{parts.name}</span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Not set</span>
                        )}
                    </span>
                    <ChevronDown
                        size={12}
                        className={cn(
                            "text-muted-foreground transition-transform shrink-0",
                            isOpen && "rotate-180"
                        )}
                    />
                </button>
                {portal}
            </div>
        </div>
    );
}
