'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, ChevronDown, Search, Loader2, AlertCircle } from 'lucide-react';
import { useOpenClawModelStore } from '@/stores/useOpenClawModelStore';
import { useOpenClawStore } from '@/store/useOpenClawStore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentModelSelectorProps {
    agentId: string;
    colorHex?: string;
}

export function AgentModelSelector({ agentId, colorHex = '#f97316' }: AgentModelSelectorProps) {
    const isConnected = useOpenClawStore((s) => s.isConnected);
    const {
        activeModels,
        defaults,
        modelCatalog,
        isModelLoading,
        modelError,
        pendingChanges,
        fetchModels,
        bufferChange,
    } = useOpenClawModelStore();
    
    // Legacy mapping (we only care about primary here)
    const activeModelsPrimary = activeModels.primary;
    const defaultModel = defaults.primary;
    
    // Get the pending primary change if any
    const pendingPrimaryChange = Array.from(pendingChanges.values()).find(
        (c) => c.role === 'primary' && c.agentId === (agentId || 'main')
    );

    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

    // Fetch models on mount if connected
    useEffect(() => {
        if (isConnected && modelCatalog.length === 0 && !isModelLoading) {
            fetchModels();
        }
    }, [isConnected, modelCatalog.length, isModelLoading, fetchModels]);

    // Calculate dropdown position from trigger button
    const updatePosition = useCallback(() => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 4,
                left: rect.left,
            });
        }
    }, []);

    // Update position when opened and on scroll/resize
    useEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isOpen, updatePosition]);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            const target = e.target as Node;
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false);
                setSearch('');
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [isOpen]);

    const openClawAgentId = agentId || 'main';

    const currentModel = useMemo(() => {
        if (pendingPrimaryChange) {
            return pendingPrimaryChange.modelRef;
        }
        return activeModelsPrimary[openClawAgentId] ?? defaultModel ?? null;
    }, [activeModelsPrimary, defaultModel, openClawAgentId, pendingPrimaryChange]);

    const isDefaultAgent = useMemo(() => {
        const agentModel = activeModelsPrimary[openClawAgentId];
        return !agentModel || agentModel === defaultModel;
    }, [activeModelsPrimary, openClawAgentId, defaultModel]);

    const displayParts = useMemo(() => {
        if (!currentModel || currentModel === 'unknown') return null;
        const slashIndex = currentModel.indexOf('/');
        if (slashIndex > -1) {
            return {
                provider: currentModel.substring(0, slashIndex),
                name: currentModel.substring(slashIndex + 1),
            };
        }
        return { provider: '', name: currentModel };
    }, [currentModel]);

    const filteredModels = useMemo(() => {
        if (!search.trim()) return modelCatalog;
        const q = search.toLowerCase();
        return modelCatalog.filter(
            (m) =>
                m.ref.toLowerCase().includes(q) ||
                (m.alias && m.alias.toLowerCase().includes(q)) ||
                m.provider.toLowerCase().includes(q) ||
                m.modelName.toLowerCase().includes(q)
        );
    }, [modelCatalog, search]);

    const handleSelectModel = (modelRef: string) => {
        bufferChange(openClawAgentId, 'primary', modelRef, isDefaultAgent);
        setIsOpen(false);
        setSearch('');
    };

    // ─── Not connected ──────────────────────────────────────────────
    if (!isConnected) {
        return (
            <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Model</div>
                <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono opacity-50 cursor-not-allowed"
                    style={{
                        background: `${colorHex}10`,
                        border: `1px solid ${colorHex}25`,
                    }}
                >
                    <Cpu size={12} className="text-white/30" />
                    <span className="text-white/40">No model set</span>
                </div>
            </div>
        );
    }

    // ─── Loading ─────────────────────────────────────────────────────
    if (isModelLoading && !currentModel) {
        return (
            <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Model</div>
                <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono"
                    style={{
                        background: `${colorHex}10`,
                        border: `1px solid ${colorHex}30`,
                    }}
                >
                    <Loader2 size={12} className="text-white/40 animate-spin" />
                    <span className="text-white/50">Loading...</span>
                </div>
            </div>
        );
    }

    // ─── Error ───────────────────────────────────────────────────────
    if (modelError && !currentModel) {
        return (
            <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Model</div>
                <button
                    onClick={() => fetchModels()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-mono
                        bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors"
                >
                    <AlertCircle size={12} className="text-red-400" />
                    <span className="text-red-400/80">Error — retry</span>
                </button>
            </div>
        );
    }

    const isPending = !!pendingPrimaryChange;

    // ─── Dropdown portal ─────────────────────────────────────────────
    const dropdownPortal = isOpen && typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
                <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="fixed z-[9999] w-64 rounded-md border border-white/10 bg-[#0a0a0a] shadow-2xl overflow-hidden"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                >
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-white/5">
                        <span className="text-[10px] uppercase tracking-widest font-mono text-white/40">
                            Select Primary Model
                        </span>
                    </div>

                    {/* Search */}
                    <div className="p-2 border-b border-white/5">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                            <Search size={12} className="text-white/30 shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search models..."
                                autoFocus
                                className="bg-transparent outline-none text-xs font-mono text-white/80 placeholder:text-white/25 w-full"
                            />
                        </div>
                    </div>

                    {/* Model list */}
                    <div className="max-h-48 overflow-y-auto py-1">
                        {filteredModels.length === 0 ? (
                            <div className="px-3 py-4 text-center">
                                <p className="text-xs font-mono text-white/30">No models found</p>
                            </div>
                        ) : (
                            filteredModels.map((model) => {
                                const isActive = model.ref === currentModel;
                                return (
                                    <button
                                        key={model.ref}
                                        onClick={() => handleSelectModel(model.ref)}
                                        className={cn(
                                            'w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-mono',
                                            'hover:bg-white/5 transition-colors',
                                            isActive && 'bg-orange-500/10 text-orange-400'
                                        )}
                                    >
                                        <span className={cn(
                                            "size-1.5 rounded-full shrink-0",
                                            isActive ? "bg-orange-400" : "bg-white/10"
                                        )} />
                                        <span className="flex flex-col min-w-0">
                                            <span className="flex items-center gap-0.5 truncate">
                                                <span className="text-white/35">{model.provider}/</span>
                                                <span className={isActive ? 'text-orange-400' : 'text-white/80'}>
                                                    {model.modelName}
                                                </span>
                                            </span>
                                            {model.alias && (
                                                <span className="text-[10px] text-white/25 truncate">
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
            <div className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Model</div>

            {/* Trigger button */}
            <button
                ref={triggerRef}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setSearch('');
                }}
                className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-mono transition-all cursor-pointer",
                    "hover:brightness-125",
                    isPending && "ring-1 ring-emerald-500/40"
                )}
                style={{
                    background: `${colorHex}15`,
                    border: `1px solid ${isPending ? 'rgba(16,185,129,0.4)' : `${colorHex}40`}`,
                }}
            >
                <Cpu size={12} style={{ color: colorHex }} />
                {displayParts ? (
                    <span className="flex items-center gap-0.5 truncate max-w-[180px]">
                        <span className="text-white/40 truncate">{displayParts.provider}/</span>
                        <span className="text-white/90 truncate">{displayParts.name}</span>
                    </span>
                ) : (
                    <span className="text-white/50">No model set</span>
                )}
                <ChevronDown
                    size={10}
                    className={cn(
                        "text-white/30 transition-transform shrink-0",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            {/* Dropdown rendered via portal to escape overflow:hidden */}
            {dropdownPortal}
        </div>
    );
}
