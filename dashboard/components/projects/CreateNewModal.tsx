"use client";

import { usePMStore } from "@/store/usePMStore";
import { FileText, Folder, Briefcase, GitBranch, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CreateNewModalProps {
    open: boolean;
    onClose: () => void;
}

const CREATION_OPTIONS = [
    {
        id: 'task' as const,
        icon: FileText,
        label: 'Task',
        description: 'Create a new task with full details',
        color: 'text-blue-400',
        bgHover: 'hover:border-blue-400/30 hover:bg-blue-400/5',
    },
    {
        id: 'folder' as const,
        icon: Folder,
        label: 'Folder',
        description: 'Organize items into a folder',
        color: 'text-accent-base',
        bgHover: 'hover:border-accent-base/30 hover:bg-accent-base/5',
    },
    {
        id: 'project' as const,
        icon: Briefcase,
        label: 'Project',
        description: 'Start a new project workspace',
        color: 'text-amber-400',
        bgHover: 'hover:border-amber-400/30 hover:bg-amber-400/5',
    },
    {
        id: 'workflow' as const,
        icon: GitBranch,
        label: 'Workflow',
        description: 'Design an automated workflow',
        color: 'text-accent-violet',
        bgHover: 'hover:border-accent-violet/30 hover:bg-accent-violet/5',
    },
];

export function CreateNewModal({ open, onClose }: CreateNewModalProps) {
    const setCreateTaskOpen = usePMStore((s) => s.setCreateTaskOpen);
    const setCreateWorkflowItemOpen = usePMStore((s) => s.setCreateWorkflowItemOpen);
    const setCreateFolderOpen = usePMStore((s) => s.setCreateFolderOpen);

    const handleSelect = (id: 'task' | 'folder' | 'project' | 'workflow') => {
        onClose();
        switch (id) {
            case 'task':
                setCreateTaskOpen(true);
                break;
            case 'folder':
                usePMStore.getState().setCreateFolderType('folder');
                setCreateFolderOpen(true);
                break;
            case 'project':
                usePMStore.getState().setCreateFolderType('project');
                setCreateFolderOpen(true);
                break;
            case 'workflow':
                setCreateWorkflowItemOpen(true);
                break;
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="fixed inset-0 z-[301] flex items-center justify-center pointer-events-none"
                    >
                        <div
                            className="pointer-events-auto bg-card border border-border/60 rounded-xl shadow-2xl w-full max-w-md p-5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-[15px] font-semibold text-foreground">Create New</h2>
                                <button
                                    onClick={onClose}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Option Cards */}
                            <div className="grid grid-cols-2 gap-2.5">
                                {CREATION_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleSelect(option.id)}
                                        className={cn(
                                            "flex flex-col items-start gap-2 p-3.5 rounded-lg border border-border/40 transition-all duration-150 text-left group cursor-pointer",
                                            option.bgHover
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center bg-foreground/3 group-hover:bg-foreground/5 transition-colors",
                                        )}>
                                            <option.icon className={cn("w-4 h-4", option.color)} />
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-medium text-foreground">{option.label}</div>
                                            <div className="text-[11px] text-muted-foreground/50 leading-tight mt-0.5">{option.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
