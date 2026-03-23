'use client';

import { cn } from '@/lib/utils';
import { FileText, Loader2 } from 'lucide-react';

interface WorkspaceFile {
    name: string;
    size: number;
    modified: number;
}

interface FileListProps {
    files: WorkspaceFile[];
    selectedFileName: string | null;
    isLoading: boolean;
    onSelectFile: (fileName: string) => void;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(timestampMs: number): string {
    if (!timestampMs) return '';
    const now = Date.now();
    const diffMs = now - timestampMs;
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
}

export function FileList({ files, selectedFileName, isLoading, onSelectFile }: FileListProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 text-white/30 animate-spin" />
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className="flex items-center justify-center py-12 px-4">
                <p className="text-xs font-mono text-white/30 text-center">
                    No workspace files found for this agent.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-1.5 p-2">
            {files.map((file) => {
                const isSelected = file.name === selectedFileName;
                return (
                    <button
                        key={file.name}
                        onClick={() => onSelectFile(file.name)}
                        className={cn(
                            'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                            'hover:bg-white/5',
                            isSelected
                                ? 'bg-orange-500/10 border border-orange-500/30'
                                : 'border border-transparent'
                        )}
                    >
                        <FileText
                            size={14}
                            className={cn(
                                'mt-0.5 shrink-0',
                                isSelected ? 'text-orange-400' : 'text-white/30'
                            )}
                        />
                        <div className="flex flex-col min-w-0">
                            <span className={cn(
                                'text-xs font-mono font-semibold truncate',
                                isSelected ? 'text-orange-400' : 'text-white/80'
                            )}>
                                {file.name}
                            </span>
                            <span className="text-[10px] font-mono text-white/30 mt-0.5">
                                {formatFileSize(file.size)}
                                {file.modified > 0 && ` · ${formatRelativeTime(file.modified)}`}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
