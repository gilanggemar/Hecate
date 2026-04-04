'use client';

// nodes/CEONode.tsx
// Premium golden CEO node — the apex of the constellation.
// Editable: double-click to modify name, title, subtitle.
// Persisted via constellation store's ceoConfig state.

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Crown, Pencil, Check } from 'lucide-react';

export interface CEONodeData {
    name: string;
    title: string;
    subtitle: string;
    onUpdate?: (field: string, value: string) => void;
}

function CEONodeComponent({ data }: NodeProps & { data: CEONodeData }) {
    const { name, title, subtitle, onUpdate } = data;
    const [editing, setEditing] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    const startEdit = useCallback((field: string, currentValue: string) => {
        if (!onUpdate) return;
        setEditing(field);
        setDraft(currentValue);
    }, [onUpdate]);

    const commitEdit = useCallback(() => {
        if (editing && onUpdate && draft.trim()) {
            onUpdate(editing, draft.trim());
        }
        setEditing(null);
        setDraft('');
    }, [editing, draft, onUpdate]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitEdit();
        if (e.key === 'Escape') { setEditing(null); setDraft(''); }
    }, [commitEdit]);

    const renderField = (field: string, value: string, className: string, style?: React.CSSProperties) => {
        if (editing === field) {
            return (
                <div className="flex items-center gap-1">
                    <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={commitEdit}
                        className="bg-transparent border-b border-amber-400/40 outline-none text-center"
                        style={{ ...style, width: '100%' }}
                    />
                </div>
            );
        }
        return (
            <span
                className={`${className} ${onUpdate ? 'cursor-pointer hover:opacity-80' : ''}`}
                style={style}
                onDoubleClick={() => startEdit(field, value)}
            >
                {value}
            </span>
        );
    };

    return (
        <motion.div
            initial={{ scale: 0.6, opacity: 0, y: -30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="select-none"
            style={{ width: 320 }}
        >
            {/* Connection handle — bottom center */}
            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-4 !h-4" />

            {/* Soft ambient glow — no spin, no box */}
            <div
                className="absolute -inset-4 rounded-2xl opacity-15 blur-xl"
                style={{
                    background: 'radial-gradient(ellipse at center, #f59e0b35, transparent 70%)',
                }}
            />

            {/* Card body */}
            <div
                className="relative rounded-xl overflow-hidden"
                style={{
                    background: 'linear-gradient(160deg, rgba(20, 16, 8, 0.97), rgba(10, 10, 14, 0.98), rgba(15, 12, 6, 0.97))',
                    boxShadow: '0 4px 60px rgba(245, 158, 11, 0.06), 0 0 0 1px rgba(245, 158, 11, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                }}
            >
                {/* Top gradient border */}
                <div
                    className="h-[2px] w-full"
                    style={{
                        background: 'linear-gradient(90deg, transparent 5%, #d97706, #f59e0b, #fbbf24, #f59e0b, #d97706, transparent 95%)',
                    }}
                />

                {/* Content */}
                <div className="px-6 py-5 flex flex-col items-center text-center space-y-3">

                    {/* Crown with glow */}
                    <div className="relative">
                        <div
                            className="absolute -inset-3 rounded-full blur-lg opacity-30"
                            style={{ background: '#fbbf24' }}
                        />
                        <div
                            className="relative w-10 h-10 rounded-full flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(251, 191, 36, 0.08))',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                            }}
                        >
                            <Crown
                                className="size-5"
                                style={{ color: '#fbbf24' }}
                                strokeWidth={1.5}
                            />
                        </div>
                    </div>

                    {/* Name — large gradient text */}
                    <div>
                        {renderField(
                            'name',
                            name,
                            'text-[18px] font-bold tracking-wide block',
                            {
                                background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                letterSpacing: '0.04em',
                            }
                        )}
                    </div>

                    {/* Title */}
                    <div className="space-y-1">
                        {renderField('title', title,
                            'text-[10px] font-mono font-bold tracking-[0.2em] uppercase block',
                            { color: 'rgba(251, 191, 36, 0.55)' }
                        )}
                        {renderField('subtitle', subtitle,
                            'text-[9px] font-mono block',
                            { color: 'rgba(255, 255, 255, 0.2)' }
                        )}
                    </div>

                    {/* Decorative wide divider */}
                    <div className="w-full flex items-center gap-2">
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #f59e0b25)' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/20 border border-amber-500/30" />
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #f59e0b25, transparent)' }} />
                    </div>

                    {/* Bottom status row */}
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse" />
                            <span className="text-[8px] font-mono tracking-[0.15em] text-white/15 uppercase">Apex Node</span>
                        </div>
                        {onUpdate && (
                            <button
                                onClick={() => startEdit('name', name)}
                                className="flex items-center gap-1 text-[8px] font-mono text-amber-500/30 hover:text-amber-400/60 transition-colors"
                            >
                                <Pencil className="size-2.5" />
                                edit
                            </button>
                        )}
                    </div>
                </div>

                {/* Bottom gradient border */}
                <div
                    className="h-[1px] w-full"
                    style={{
                        background: 'linear-gradient(90deg, transparent 10%, #f59e0b20, transparent 90%)',
                    }}
                />
            </div>
        </motion.div>
    );
}

export const CEONode = memo(CEONodeComponent);
