'use client';

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useOpenClawCapabilitiesStore } from '@/stores/useOpenClawCapabilitiesStore';
import { AgentSelector } from './AgentSelector';
import { FileList } from './FileList';
import { FileEditor } from './FileEditor';

export function CoreFilesPanel() {
    const {
        agents,
        selectedAgentId,
        setSelectedAgentId,
        workspaceFiles,
        selectedFileName,
        selectedFileContent,
        selectedFilePath,
        fileDraftContent,
        isFileDirty,
        isFilesLoading,
        isFileContentLoading,
        isFileSaving,
        fileError,
        fetchWorkspaceFiles,
        selectFile,
        updateFileDraft,
        saveFile,
        resetFileDraft,
        clearFileSelection,
    } = useOpenClawCapabilitiesStore();

    // Auto-select first agent if none selected
    useEffect(() => {
        if (!selectedAgentId && agents.length > 0) {
            const defaultAgent = agents.find(a => a.default) || agents[0];
            setSelectedAgentId(defaultAgent.id);
        }
    }, [selectedAgentId, agents, setSelectedAgentId]);

    // Fetch workspace files when agent changes
    useEffect(() => {
        if (selectedAgentId) {
            fetchWorkspaceFiles(selectedAgentId);
            clearFileSelection();
        }
    }, [selectedAgentId, fetchWorkspaceFiles, clearFileSelection]);

    const handleAgentChange = (agentId: string | null) => {
        if (isFileDirty) {
            const confirm = window.confirm(
                `You have unsaved changes to ${selectedFileName}. Discard changes?`
            );
            if (!confirm) return;
        }
        setSelectedAgentId(agentId);
    };

    const handleSelectFile = (fileName: string) => {
        if (isFileDirty && fileName !== selectedFileName) {
            const confirm = window.confirm(
                `You have unsaved changes to ${selectedFileName}. Discard changes?`
            );
            if (!confirm) return;
        }
        if (selectedAgentId) {
            selectFile(selectedAgentId, fileName);
        }
    };

    const handleSave = () => {
        if (selectedAgentId) {
            saveFile(selectedAgentId);
        }
    };

    // Derive the workspace path from the first file's path or selected file path
    const workspacePath = selectedFilePath
        ? selectedFilePath.substring(0, selectedFilePath.lastIndexOf('/'))
        : null;

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-white/90 font-mono">Core Files</h2>
                    <p className="text-[10px] font-mono text-white/35 mt-0.5">
                        Bootstrap persona, identity, and tool guidance.
                    </p>
                </div>
                <button
                    onClick={() => selectedAgentId && fetchWorkspaceFiles(selectedAgentId)}
                    disabled={isFilesLoading || !selectedAgentId}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono
                        bg-white/5 text-white/50 border border-white/10
                        hover:bg-white/8 hover:text-white/70 transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className={`size-3 ${isFilesLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Agent Selector */}
            <AgentSelector
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelect={handleAgentChange}
            />

            {/* Workspace path */}
            {workspacePath && (
                <div className="text-[10px] font-mono text-white/25">
                    Workspace: {workspacePath}
                </div>
            )}

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-[400px]">
                {/* Left: File List */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                    <FileList
                        files={workspaceFiles}
                        selectedFileName={selectedFileName}
                        isLoading={isFilesLoading}
                        onSelectFile={handleSelectFile}
                    />
                </div>

                {/* Right: File Editor */}
                <FileEditor
                    fileName={selectedFileName}
                    filePath={selectedFilePath}
                    content={fileDraftContent}
                    isDirty={isFileDirty}
                    isLoading={isFileContentLoading}
                    isSaving={isFileSaving}
                    error={fileError}
                    onContentChange={updateFileDraft}
                    onSave={handleSave}
                    onReset={resetFileDraft}
                />
            </div>

            {/* Footer Notice */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500/70" />
                <p className="text-xs font-mono text-amber-500/70 leading-relaxed">
                    Changes are saved to the real OpenClaw workspace.
                    They take effect on the agent&apos;s next session/turn.
                </p>
            </div>
        </div>
    );
}
