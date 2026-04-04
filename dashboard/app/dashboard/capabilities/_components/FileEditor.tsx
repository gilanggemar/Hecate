'use client';

import { useState } from 'react';
import { Loader2, RotateCcw, Save, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExpandedEditor } from './ExpandedEditor';

interface FileEditorProps {
    fileName: string | null;
    filePath: string | null;
    content: string | null;
    isDirty: boolean;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    onContentChange: (content: string) => void;
    onSave: () => void;
    onReset: () => void;
}

export function FileEditor({
    fileName,
    filePath,
    content,
    isDirty,
    isLoading,
    isSaving,
    error,
    onContentChange,
    onSave,
    onReset,
}: FileEditorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isHoveringEditor, setIsHoveringEditor] = useState(false);

    // No file selected
    if (!fileName) {
        return (
            <div className="flex items-center justify-center h-full min-h-[300px] rounded-md border border-white/5 bg-white/[0.02]">
                <p className="text-xs font-mono text-white/25">
                    Select a file from the list to view and edit its content.
                </p>
            </div>
        );
    }

    // Loading file content
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[300px] rounded-md border border-white/5 bg-white/[0.02]">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-5 text-white/30 animate-spin" />
                    <p className="text-xs font-mono text-white/30">Loading {fileName}...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col rounded-md border border-white/10 bg-white/[0.02] overflow-hidden">
                {/* File Header */}
                <div className="px-4 py-3 border-b border-white/5">
                    <h3 className="text-sm font-mono font-semibold text-white/90">{fileName}</h3>
                    {filePath && (
                        <p className="text-[10px] font-mono text-white/25 mt-0.5 truncate">{filePath}</p>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs font-mono text-red-400/80">{error}</p>
                    </div>
                )}

                {/* Content Label */}
                <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] uppercase tracking-widest font-mono text-white/30">
                        Content
                    </span>
                </div>

                {/* Text Editor with expand button */}
                <div
                    className="px-4 pb-3 flex-1 relative"
                    onMouseEnter={() => setIsHoveringEditor(true)}
                    onMouseLeave={() => setIsHoveringEditor(false)}
                >
                    <textarea
                        value={content ?? ''}
                        onChange={(e) => onContentChange(e.target.value)}
                        onKeyDown={(e) => {
                            // Support tab key insertion
                            if (e.key === 'Tab') {
                                e.preventDefault();
                                const target = e.target as HTMLTextAreaElement;
                                const start = target.selectionStart;
                                const end = target.selectionEnd;
                                const newValue = content!.substring(0, start) + '  ' + content!.substring(end);
                                onContentChange(newValue);
                                // Restore cursor position
                                setTimeout(() => {
                                    target.selectionStart = target.selectionEnd = start + 2;
                                }, 0);
                            }
                        }}
                        className={cn(
                            'w-full min-h-[350px] max-h-[600px] resize-y rounded-lg',
                            'bg-[#0a0a0a] border border-white/10',
                            'px-4 py-3 text-xs font-mono text-white/80 leading-relaxed',
                            'placeholder:text-white/20',
                            'focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/30',
                            'transition-colors',
                        )}
                        placeholder="File is empty. Start typing to add content..."
                        spellCheck={false}
                    />

                    {/* Expand button - appears on hover */}
                    <button
                        onClick={() => setIsExpanded(true)}
                        className={cn(
                            'absolute top-2 right-6 p-1.5 rounded-lg transition-all duration-200',
                            'bg-white/5 border border-white/10 text-white/40',
                            'hover:bg-orange-500/15 hover:text-orange-400 hover:border-orange-500/25',
                            'hover:shadow-[0_0_12px_-3px_rgba(249,115,22,0.3)]',
                            isHoveringEditor
                                ? 'opacity-100 translate-y-0'
                                : 'opacity-0 -translate-y-1 pointer-events-none'
                        )}
                        title="Open expanded editor"
                    >
                        <Maximize2 size={13} />
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/5">
                    <button
                        onClick={onReset}
                        disabled={!isDirty || isSaving}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                            'border border-white/10 bg-transparent',
                            isDirty && !isSaving
                                ? 'text-white/60 hover:bg-white/5 hover:text-white/80'
                                : 'text-white/20 cursor-not-allowed opacity-50'
                        )}
                    >
                        <RotateCcw size={12} />
                        Reset
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!isDirty || isSaving}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                            isDirty && !isSaving
                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 shadow-[0_0_15px_-3px_rgba(249,115,22,0.2)]'
                                : 'bg-white/5 text-white/20 border border-white/10 cursor-not-allowed opacity-50'
                        )}
                    >
                        {isSaving ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Save size={12} />
                        )}
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Expanded Editor Overlay */}
            {isExpanded && (
                <ExpandedEditor
                    fileName={fileName}
                    filePath={filePath}
                    initialContent={content ?? ''}
                    onConfirm={(editedContent) => {
                        onContentChange(editedContent);
                        setIsExpanded(false);
                    }}
                    onCancel={() => setIsExpanded(false)}
                />
            )}
        </>
    );
}
