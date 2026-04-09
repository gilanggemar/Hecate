'use client';

import { Pencil } from 'lucide-react';
import { usePromptChunkStore } from '@/store/usePromptChunkStore';
import type { PromptChunk } from '@/store/usePromptChunkStore';
import React from 'react';

interface Props {
    chunk: PromptChunk;
}

export function PromptChunkPill({ chunk }: Props) {
    const { openEditDialog } = usePromptChunkStore();

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('application/x-prompt-chunk-id', chunk.id);
        e.dataTransfer.effectAllowed = 'copy';
        // HTML5 dragover events cannot read dataTransfer data, so we store it globally for the live preview placeholder
        (window as any).__draggingChunkName = chunk.name;
        (window as any).__draggingChunkColor = chunk.color;
    };

    const handleInsert = () => {
        window.dispatchEvent(new CustomEvent('insert-prompt-chunk', { detail: { id: chunk.id } }));
    };

    return (
        <div
            role="button"
            tabIndex={0}
            draggable
            onDragStart={handleDragStart}
            onMouseDown={(e) => { e.preventDefault(); }} // Prevent stealing focus/caret from input
            onClick={handleInsert}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleInsert(); }}
            className="group relative flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer select-none transition-all duration-150 hover:scale-[1.03]"
            style={{
                backgroundColor: `${chunk.color}20`,
                borderWidth: '1px',
                borderColor: `${chunk.color}50`,
                color: chunk.color,
            }}
            title={`Click to insert "${chunk.name}" • Drag to place in input`}
            aria-label={`Prompt chunk: ${chunk.name}`}
        >

            {/* Name */}
            <span className="text-xs font-medium truncate max-w-[80px]">
                {chunk.name}
            </span>

            {/* Edit pencil (visible on hover) */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    openEditDialog(chunk);
                }}
                className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity duration-150 ml-0.5"
                title="Edit chunk"
                aria-label={`Edit ${chunk.name}`}
            >
                <Pencil size={11} />
            </button>
        </div>
    );
}
