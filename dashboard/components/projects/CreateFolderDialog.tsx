"use client";

import { useState, useEffect } from "react";
import { usePMStore } from "@/store/usePMStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Folder, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function CreateFolderDialog() {
    const open = usePMStore((s) => s.createFolderOpen);
    const folderType = usePMStore((s) => s.createFolderType);
    const setOpen = usePMStore((s) => s.setCreateFolderOpen);
    const createFolder = usePMStore((s) => s.createFolder);
    const createProject = usePMStore((s) => s.createProject);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const spaces = usePMStore((s) => s.spaces);
    const folders = usePMStore((s) => s.folders);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setName("");
            setDescription("");
        }
    }, [open]);

    const isProject = folderType === 'project';
    const Icon = isProject ? Briefcase : Folder;
    const label = isProject ? 'Project' : 'Folder';
    const accentColor = isProject ? 'text-amber-400' : 'text-accent-base';
    const accentBg = isProject ? 'bg-amber-400/15' : 'bg-accent-base/15';
    const buttonBg = isProject ? 'bg-amber-500 hover:bg-amber-600' : 'bg-accent-base hover:bg-accent-base/90';

    const activeSpace = spaces.find((s) => s.id === activeSpaceId);

    // Build breadcrumb for parent location
    const parentLabel = (() => {
        if (activeFolderId) {
            const folder = folders.find(f => f.id === activeFolderId);
            return folder ? folder.name : 'Current folder';
        }
        return activeSpace?.name || 'Space root';
    })();

    const handleCreate = async () => {
        if (!name.trim() || !activeSpaceId) return;
        setIsCreating(true);
        try {
            if (isProject) {
                await createProject(activeSpaceId, name.trim(), activeFolderId || undefined);
            } else {
                await createFolder(activeSpaceId, name.trim(), activeFolderId || undefined);
            }
            setOpen(false);
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => setOpen(false);

    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-md border border-border rounded-xl bg-card shadow-2xl relative flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", accentBg)}>
                                <Icon className={cn("w-3.5 h-3.5", accentColor)} />
                            </div>
                            <span className="text-[13px] font-medium text-foreground">New {label}</span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Form */}
                    <div className="px-5 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
                        {/* Location indicator */}
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                            <span>Creating in:</span>
                            <span className="font-medium text-muted-foreground/70">{parentLabel}</span>
                        </div>

                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">{label} Name</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={isProject ? "e.g. Website Redesign, Q3 Sprint" : "e.g. Research, Assets, Documents"}
                                className="h-8 text-[12px] rounded-md border-border bg-background"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && name.trim()) handleCreate();
                                    if (e.key === 'Escape') handleClose();
                                }}
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">
                                Description <span className="text-muted-foreground/30">(optional)</span>
                            </label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={isProject ? "What is this project about..." : "What will this folder contain..."}
                                className="min-h-14 text-[12px] rounded-md border-border bg-background resize-none"
                            />
                        </div>

                        {/* Preview */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Preview</label>
                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-background border border-border/50">
                                <Icon className={cn("w-4 h-4", accentColor)} />
                                <span className="text-[12px] text-foreground font-medium">
                                    {name.trim() || (isProject ? "My Project" : "My Folder")}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/50 shrink-0">
                        <Button
                            onClick={handleClose}
                            variant="ghost"
                            size="sm"
                            className="h-8 px-4 rounded-md text-[11px]"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            className={cn("h-8 px-5 rounded-md text-[11px] text-white gap-1.5 disabled:opacity-30", buttonBg)}
                            onClick={handleCreate}
                            disabled={!name.trim() || isCreating || !activeSpaceId}
                        >
                            <Icon className="w-3 h-3" />
                            {isCreating ? 'Creating...' : `Create ${label}`}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
