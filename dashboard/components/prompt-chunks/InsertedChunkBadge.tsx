'use client';

import type { PromptChunk } from '@/store/usePromptChunkStore';

interface Props {
    chunk: PromptChunk;
    expanded: boolean;
    onDoubleClick: (e: React.MouseEvent) => void;
}

export function InsertedChunkBadge({ chunk, expanded, onDoubleClick }: Props) {
    if (expanded) {
        return (
            <span
                onDoubleClick={onDoubleClick}
                className="inline rounded px-1 py-0.5 text-[0.95em] cursor-pointer"
                style={{
                    backgroundColor: `${chunk.color}20`,
                    color: chunk.color,
                    borderBottom: `1px solid ${chunk.color}50`,
                }}
                title="Double-click to collapse"
            >
                {chunk.content}
            </span>
        );
    }

    return (
        <span
            onDoubleClick={onDoubleClick}
            className="inline-flex items-center gap-1 min-w-0 max-w-[150px] rounded px-1.5 py-0.5 mx-[2px] text-[0.85em] font-medium cursor-pointer"
            style={{
                backgroundColor: `${chunk.color}30`,
                color: chunk.color,
                border: `1px solid ${chunk.color}50`,
            }}
            title={`Prompt Chunk: ${chunk.name}\nDouble-click to preview content`}
        >
            <span className="truncate">{chunk.name}</span>
        </span>
    );
}
