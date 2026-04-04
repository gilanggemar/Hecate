'use client';

import { useEffect, useState } from 'react';
import { useOpenClawCapabilitiesStore } from '@/stores/useOpenClawCapabilitiesStore';
import { useOpenClawModelStore } from '@/stores/useOpenClawModelStore';
import { useOpenClawStore } from '@/store/useOpenClawStore';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Loader2 } from 'lucide-react';

import { ConnectionGuard } from './ConnectionGuard';
import { TabSwitcher } from './TabSwitcher';
import { AgentSelector } from './AgentSelector';
import { ToolsColumn } from './ToolsColumn';
import { SkillsColumn } from './SkillsColumn';
import { CoreFilesPanel } from './CoreFilesPanel';
import { FooterNotice } from './FooterNotice';
import { SkillsManagerModal } from './SkillsManagerModal';

export function CapabilitiesClient() {
    const isConnected = useOpenClawStore((s) => s.isConnected);
    const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);

    const {
        activeTab,
        setActiveTab,
        selectedAgentId,
        setSelectedAgentId,
        agents,
        globalTools,
        globalSkills,
        perAgentTools,
        perAgentSkills,
        isLoading,
        error,
        togglingItems,
        hasUnsavedChanges,
        isApplying,
        isFileDirty,
        fetchAll,
        applyChanges,
        discardChanges,
        resetFileDraft,
        toggleGlobalTool,
        toggleGlobalSkill,
        togglePerAgentTool,
        togglePerAgentSkill,
    } = useOpenClawCapabilitiesStore();

    const {
        hasUnsavedChanges: hasUnsavedModelChange,
        applyAllChanges: applyModelChange,
        discardAllChanges: discardModelChange,
    } = useOpenClawModelStore();

    // Combined unsaved state — any of these means we have pending changes
    const anyUnsavedChanges = hasUnsavedChanges || hasUnsavedModelChange;

    // Fetch data when connected
    useEffect(() => {
        if (isConnected) {
            fetchAll();
        }
    }, [isConnected, fetchAll]);

    // Auto-select first agent if none selected
    useEffect(() => {
        if ((activeTab === 'per-agent' || activeTab === 'core-files') && !selectedAgentId && agents.length > 0) {
            const defaultAgent = agents.find(a => a.default) || agents[0];
            setSelectedAgentId(defaultAgent.id);
        }
    }, [activeTab, selectedAgentId, agents, setSelectedAgentId]);

    // Determine which tools/skills to show based on tab
    const displayTools = activeTab === 'global'
        ? globalTools
        : (selectedAgentId ? perAgentTools[selectedAgentId] || [] : []);

    const displaySkills = activeTab === 'global'
        ? globalSkills
        : (selectedAgentId ? perAgentSkills[selectedAgentId] || [] : []);

    const handleToolToggle = (toolName: string, allowed: boolean) => {
        if (activeTab === 'global') {
            toggleGlobalTool(toolName, allowed);
        } else if (selectedAgentId) {
            togglePerAgentTool(selectedAgentId, toolName, allowed);
        }
    };

    const handleSkillToggle = (skillKey: string, enabled: boolean) => {
        if (activeTab === 'global') {
            toggleGlobalSkill(skillKey, enabled);
        } else if (selectedAgentId) {
            togglePerAgentSkill(selectedAgentId, skillKey, enabled);
        }
    };

    const handleApplyAll = async () => {
        // Apply config changes (tools/skills)
        if (hasUnsavedChanges) {
            await applyChanges();
        }
        // Apply model changes
        if (hasUnsavedModelChange) {
            await applyModelChange();
        }
    };

    const handleDiscardAll = () => {
        // Discard config changes (tools/skills)
        if (hasUnsavedChanges) {
            discardChanges();
        }
        // Discard model changes
        if (hasUnsavedModelChange) {
            discardModelChange();
        }
        // Discard file draft changes
        if (isFileDirty) {
            resetFileDraft();
        }
    };

    return (
        <div className="flex flex-col h-full px-6 py-6 space-y-5">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-white/95 tracking-tight">
                        Capabilities
                    </h1>
                    <p className="text-xs font-mono text-white/35 mt-0.5">
                        Manage tools, skills, and workspace files on the OpenClaw Gateway
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {anyUnsavedChanges && (
                        <AnimatePresence>
                            <motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                className="flex items-center gap-2"
                            >
                                <button
                                    onClick={handleDiscardAll}
                                    disabled={isApplying}
                                    className="px-3 py-1.5 rounded-lg text-xs font-mono
                                        bg-transparent text-white/50 border border-white/10
                                        hover:bg-white/5 hover:text-white/80 transition-all
                                        disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Discard
                                </button>
                                <button
                                    onClick={handleApplyAll}
                                    disabled={isApplying}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono
                                        bg-emerald-500/10 text-emerald-400 border border-emerald-500/20
                                        hover:bg-emerald-500/20 transition-all shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]
                                        disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isApplying ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : null}
                                    {isApplying ? 'Applying...' : 'Apply Config'}
                                </button>
                            </motion.div>
                        </AnimatePresence>
                    )}
                    
                    <button
                        onClick={fetchAll}
                        disabled={isLoading || isApplying}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono
                            bg-white/5 text-white/50 border border-white/10
                            hover:bg-white/8 hover:text-white/70 transition-all
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Connection Guard */}
            <ConnectionGuard>
                {/* Loading State */}
                {isLoading && globalTools.length === 0 && (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="size-6 text-white/30 animate-spin" />
                            <p className="text-xs font-mono text-white/30">
                                Fetching capabilities from Gateway...
                            </p>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="rounded-md border border-red-500/20 bg-red-500/5 px-4 py-3">
                        <p className="text-xs font-mono text-red-400/80">
                            {error}
                        </p>
                    </div>
                )}

                {/* Main Content (only show when data is loaded) */}
                {!isLoading || globalTools.length > 0 ? (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab + (activeTab !== 'core-files' ? selectedAgentId : '')}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col gap-4"
                        >
                            {/* Controls Bar */}
                            <div className="flex items-center gap-4 flex-wrap">
                                <TabSwitcher
                                    activeTab={activeTab}
                                    onTabChange={setActiveTab}
                                />
                                {activeTab === 'per-agent' && (
                                    <AgentSelector
                                        agents={agents}
                                        selectedAgentId={selectedAgentId}
                                        onSelect={setSelectedAgentId}
                                    />
                                )}
                            </div>

                            {/* Tab Content */}
                            {activeTab === 'core-files' ? (
                                <CoreFilesPanel />
                            ) : (
                                <>
                                    {/* Two-Column Layout for per-agent / global */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <ToolsColumn
                                            tools={displayTools}
                                            togglingItems={togglingItems}
                                            onToggle={handleToolToggle}
                                        />
                                        <SkillsColumn
                                            skills={displaySkills}
                                            togglingItems={togglingItems}
                                            onToggle={handleSkillToggle}
                                            onExpand={() => setIsSkillsModalOpen(true)}
                                        />
                                    </div>

                                    {/* Footer */}
                                    <FooterNotice />
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                ) : null}
            </ConnectionGuard>

            {/* Skills Manager Modal */}
            <SkillsManagerModal
                isOpen={isSkillsModalOpen}
                onClose={() => setIsSkillsModalOpen(false)}
                skills={displaySkills}
                togglingItems={togglingItems}
                onToggle={handleSkillToggle}
                activeTab={activeTab}
                selectedAgentId={selectedAgentId}
            />
        </div>
    );
}
