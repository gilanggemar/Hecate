'use client';

import {
    useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo,
    type KeyboardEvent, type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Undo2, Redo2, Bold, Italic, Underline, Strikethrough,
    Quote, List, Sparkles, Loader2, Check, RotateCcw, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { agentZeroService } from '@/lib/agentZeroService';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EditRegion {
    id: string;
    startOffset: number;
    endOffset: number;
    originalText: string;
    newText: string;
}

interface HistoryEntry {
    text: string;
    editRegions: EditRegion[];
    cursorPos: number;
    scrollTop: number;
}

interface ExpandedEditorProps {
    fileName: string;
    filePath: string | null;
    initialContent: string;
    onConfirm: (content: string) => void;
    onCancel: () => void;
}

// ─── Toolbar button helper ──────────────────────────────────────────────────

function ToolbarButton({
    icon: Icon, label, onClick, disabled, active,
}: {
    icon: any; label: string; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
    return (
        <button
            title={label}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus theft from textarea
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'p-1.5 rounded-md transition-all text-white/50 hover:text-white/80 hover:bg-white/10',
                active && 'text-orange-400 bg-orange-500/10',
                disabled && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-white/50',
            )}
        >
            <Icon size={15} />
        </button>
    );
}

function ToolbarDivider() {
    return <div className="w-px h-5 bg-white/10 mx-1" />;
}

// ─── AI inline loading spinner ──────────────────────────────────────────────

function AiLoadingSpinner({
    textareaRef,
    selectionEnd,
    text,
}: {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    selectionEnd: number;
    text: string;
}) {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;

        const taRect = ta.getBoundingClientRect();
        const styles = window.getComputedStyle(ta);

        const mirror = document.createElement('div');
        mirror.style.position = 'fixed';
        mirror.style.left = taRect.left + 'px';
        mirror.style.top = taRect.top + 'px';
        mirror.style.visibility = 'hidden';
        mirror.style.pointerEvents = 'none';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.wordWrap = 'break-word';
        mirror.style.overflow = 'hidden';
        mirror.style.width = styles.width;
        mirror.style.height = styles.height;
        mirror.style.paddingLeft = styles.paddingLeft;
        mirror.style.paddingRight = styles.paddingRight;
        mirror.style.paddingTop = styles.paddingTop;
        mirror.style.paddingBottom = styles.paddingBottom;
        mirror.style.fontSize = styles.fontSize;
        mirror.style.fontFamily = styles.fontFamily;
        mirror.style.lineHeight = styles.lineHeight;
        mirror.style.letterSpacing = styles.letterSpacing;
        mirror.style.borderWidth = styles.borderWidth;
        mirror.style.boxSizing = styles.boxSizing;
        document.body.appendChild(mirror);

        const textNode = document.createTextNode(text.substring(0, selectionEnd));
        const marker = document.createElement('span');
        marker.textContent = '|';
        mirror.appendChild(textNode);
        mirror.appendChild(marker);
        mirror.scrollTop = ta.scrollTop;

        const markerRect = marker.getBoundingClientRect();
        document.body.removeChild(mirror);

        setPos({
            x: markerRect.left + 8 - taRect.left,
            y: markerRect.top - 20 - taRect.top,
        });
    }, [textareaRef, selectionEnd, text]);

    if (!pos) return null;

    return (
        <div
            className="absolute z-10 pointer-events-none"
            style={{ left: pos.x, top: pos.y }}
        >
            <Loader2 size={14} className="text-orange-400 animate-spin" />
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ExpandedEditor({
    fileName,
    filePath,
    initialContent,
    onConfirm,
    onCancel,
}: ExpandedEditorProps) {
    // ── State ────────────────────────────────────────────────────────────────
    const [text, setText] = useState(initialContent);
    const [editRegions, setEditRegions] = useState<EditRegion[]>([]);
    const [history, setHistory] = useState<HistoryEntry[]>([
        { text: initialContent, editRegions: [], cursorPos: 0, scrollTop: 0 },
    ]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [isDirty, setIsDirty] = useState(false);

    // AI editing state
    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [showAiPopup, setShowAiPopup] = useState(false);
    const [showAiInput, setShowAiInput] = useState(false);
    const [aiInstruction, setAiInstruction] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    // Popup position relative to textarea content (not viewport) so it scrolls inline
    const [popupContentPos, setPopupContentPos] = useState({ x: 0, y: 0 });

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLDivElement>(null);
    const aiInputRef = useRef<HTMLInputElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const editorBodyRef = useRef<HTMLDivElement>(null);
    const pendingScrollRef = useRef<{ scrollTop: number; cursorPos: number } | null>(null);

    // ── Sync scroll between textarea and highlight overlay ────────────────
    const handleScroll = useCallback(() => {
        if (textareaRef.current && highlightRef.current) {
            highlightRef.current.scrollTop = textareaRef.current.scrollTop;
            highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    }, []);

    // ── Restore scroll after React re-renders textarea (useLayoutEffect runs before paint) ──
    useLayoutEffect(() => {
        const pending = pendingScrollRef.current;
        if (pending && textareaRef.current) {
            textareaRef.current.scrollTop = pending.scrollTop;
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pending.cursorPos;
            if (highlightRef.current) highlightRef.current.scrollTop = pending.scrollTop;
            pendingScrollRef.current = null;
        }
    }, [text]); // fires every time text changes

    // ── History management ───────────────────────────────────────────────────

    const pushHistory = useCallback((newText: string, newRegions: EditRegion[], cursorPos: number) => {
        const scrollTop = textareaRef.current?.scrollTop || 0;
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push({ text: newText, editRegions: newRegions, cursorPos, scrollTop });
            return newHistory;
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    const undo = useCallback(() => {
        if (historyIndex <= 0) return;
        const newIndex = historyIndex - 1;
        const entry = history[newIndex];
        // Preserve the CURRENT scroll position — do not jump anywhere
        const currentScroll = textareaRef.current?.scrollTop || 0;
        pendingScrollRef.current = { scrollTop: currentScroll, cursorPos: entry.cursorPos };
        setText(entry.text);
        setEditRegions(entry.editRegions);
        setHistoryIndex(newIndex);
        setIsDirty(entry.text !== initialContent);
        setShowAiPopup(false);
        setShowAiInput(false);
    }, [historyIndex, history, initialContent]);

    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex + 1;
        const entry = history[newIndex];
        // Preserve the CURRENT scroll position — do not jump anywhere
        const currentScroll = textareaRef.current?.scrollTop || 0;
        pendingScrollRef.current = { scrollTop: currentScroll, cursorPos: entry.cursorPos };
        setText(entry.text);
        setEditRegions(entry.editRegions);
        setHistoryIndex(newIndex);
        setIsDirty(entry.text !== initialContent);
        setShowAiPopup(false);
        setShowAiInput(false);
    }, [historyIndex, history, initialContent]);

    // ── Text formatting helpers (FIX #1: preserve scroll position) ──────────

    const wrapSelection = useCallback((before: string, after: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const savedScrollTop = ta.scrollTop;
        const sel = text.substring(start, end);
        const newText = text.substring(0, start) + before + sel + after + text.substring(end);
        setText(newText);
        setIsDirty(true);
        pushHistory(newText, editRegions, start + before.length);
        setTimeout(() => {
            ta.focus();
            ta.selectionStart = start + before.length;
            ta.selectionEnd = end + before.length;
            ta.scrollTop = savedScrollTop; // Restore scroll position
        }, 0);
    }, [text, editRegions, pushHistory]);

    const prependLines = useCallback((prefix: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const savedScrollTop = ta.scrollTop;
        const sel = text.substring(start, end);
        const lines = sel.split('\n');
        const prefixed = lines.map(l => prefix + l).join('\n');
        const newText = text.substring(0, start) + prefixed + text.substring(end);
        setText(newText);
        setIsDirty(true);
        pushHistory(newText, editRegions, start);
        setTimeout(() => {
            ta.focus();
            ta.scrollTop = savedScrollTop; // Restore scroll position
        }, 0);
    }, [text, editRegions, pushHistory]);

    const handleBold = () => wrapSelection('**', '**');
    const handleItalic = () => wrapSelection('*', '*');
    const handleUnderline = () => wrapSelection('<u>', '</u>');
    const handleStrikethrough = () => wrapSelection('~~', '~~');
    const handleQuote = () => prependLines('> ');
    const handleBullet = () => prependLines('- ');

    // ── Manual text change ───────────────────────────────────────────────────

    const handleTextChange = (newText: string) => {
        setText(newText);
        setIsDirty(newText !== initialContent);
        const cursorPos = textareaRef.current?.selectionStart || 0;
        pushHistory(newText, editRegions, cursorPos);
    };

    // ── Selection detection (FIX #2: position at top-right of cursor release) ──

    const handleSelectionChange = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta || aiLoading) return;

        const start = ta.selectionStart;
        const end = ta.selectionEnd;

        if (start !== end && end - start > 1) {
            const sel = text.substring(start, end);
            setSelectedText(sel);
            setSelectionRange({ start, end });

            // Use a hidden mirror div to measure exact pixel position of selection end
            // Position is calculated relative to the textarea content (not viewport)
            // so the popup stays inline and scrolls with the text.
            const taRect = ta.getBoundingClientRect();
            const styles = window.getComputedStyle(ta);

            const mirror = document.createElement('div');
            mirror.style.position = 'fixed';
            mirror.style.left = taRect.left + 'px';
            mirror.style.top = taRect.top + 'px';
            mirror.style.visibility = 'hidden';
            mirror.style.pointerEvents = 'none';
            mirror.style.whiteSpace = 'pre-wrap';
            mirror.style.wordWrap = 'break-word';
            mirror.style.overflow = 'hidden';
            mirror.style.width = styles.width;
            mirror.style.height = styles.height;
            mirror.style.paddingLeft = styles.paddingLeft;
            mirror.style.paddingRight = styles.paddingRight;
            mirror.style.paddingTop = styles.paddingTop;
            mirror.style.paddingBottom = styles.paddingBottom;
            mirror.style.fontSize = styles.fontSize;
            mirror.style.fontFamily = styles.fontFamily;
            mirror.style.lineHeight = styles.lineHeight;
            mirror.style.letterSpacing = styles.letterSpacing;
            mirror.style.borderWidth = styles.borderWidth;
            mirror.style.boxSizing = styles.boxSizing;
            document.body.appendChild(mirror);

            // Detect actual cursor release position using selectionDirection.
            // selectionStart/End are always ordered left-to-right, but the user
            // may have dragged right-to-left, so the cursor is at `start` in that case.
            const cursorAt = ta.selectionDirection === 'backward' ? start : end;

            // Use text up to the actual cursor release point
            const textBeforeCursor = text.substring(0, cursorAt);
            const textNode = document.createTextNode(textBeforeCursor);
            const marker = document.createElement('span');
            marker.textContent = '|';
            mirror.appendChild(textNode);
            mirror.appendChild(marker);

            // Do NOT set mirror.scrollTop — we want the marker's position
            // relative to un-scrolled content (i.e. content coordinates).

            const markerRect = marker.getBoundingClientRect();
            document.body.removeChild(mirror);

            // Position popup right at the cursor release point
            const contentX = markerRect.left - taRect.left - 9;
            const contentY = markerRect.top - taRect.top - 43;

            setPopupContentPos({
                x: Math.max(10, contentX),
                y: Math.max(0, contentY),
            });
            setShowAiPopup(true);
            setShowAiInput(false);
            setAiInstruction('');
        } else {
            setShowAiPopup(false);
            setShowAiInput(false);
        }
    }, [text, aiLoading]);

    // Debounced selection tracking via mouseup and keyup
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        const handler = () => setTimeout(handleSelectionChange, 50);
        ta.addEventListener('mouseup', handler);
        ta.addEventListener('keyup', handler);
        return () => {
            ta.removeEventListener('mouseup', handler);
            ta.removeEventListener('keyup', handler);
        };
    }, [handleSelectionChange]);

    // ── AI editing (FIX #3: only send selected text, not the full document) ──

    const handleAiEdit = async () => {
        if (!aiInstruction.trim() || !selectionRange || !selectedText) return;
        setAiLoading(true);

        const prompt = [
            'You are a precise text editor. Rewrite the following text according to the user\'s instruction.',
            'Output ONLY the rewritten text. No explanation, no surrounding content, no quotes, no markdown code fences, no preamble.',
            '',
            '=== TEXT TO REWRITE ===',
            selectedText,
            '',
            '=== INSTRUCTION ===',
            aiInstruction,
        ].join('\n');

        try {
            const res = await agentZeroService.sendMessage({ message: prompt });
            const aiOutput = (res.response || '').trim();

            if (aiOutput) {
                const { start, end } = selectionRange;
                const savedScrollTop = textareaRef.current?.scrollTop || 0;
                const newText = text.substring(0, start) + aiOutput + text.substring(end);

                // Track edited region
                const newRegion: EditRegion = {
                    id: crypto.randomUUID(),
                    startOffset: start,
                    endOffset: start + aiOutput.length,
                    originalText: selectedText,
                    newText: aiOutput,
                };

                // Adjust existing regions that follow this edit
                const lengthDelta = aiOutput.length - selectedText.length;
                const adjustedRegions = editRegions.map(r => {
                    if (r.startOffset >= end) {
                        return { ...r, startOffset: r.startOffset + lengthDelta, endOffset: r.endOffset + lengthDelta };
                    }
                    return r;
                });

                const newRegions = [...adjustedRegions, newRegion];
                setText(newText);
                setEditRegions(newRegions);
                setIsDirty(true);
                pushHistory(newText, newRegions, start + aiOutput.length);

                // Restore scroll
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.scrollTop = savedScrollTop;
                    }
                }, 0);
            }
        } catch (err: any) {
            console.error('[ExpandedEditor] AI edit failed:', err);
        } finally {
            setAiLoading(false);
            setShowAiPopup(false);
            setShowAiInput(false);
            setAiInstruction('');
            setSelectionRange(null);
            setSelectedText('');
            textareaRef.current?.focus();
        }
    };

    // ── Keyboard shortcuts ───────────────────────────────────────────────────

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // Tab insertion
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.target as HTMLTextAreaElement;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const savedScrollTop = ta.scrollTop;
            const newText = text.substring(0, start) + '  ' + text.substring(end);
            setText(newText);
            setIsDirty(true);
            pushHistory(newText, editRegions, start + 2);
            setTimeout(() => {
                ta.selectionStart = ta.selectionEnd = start + 2;
                ta.scrollTop = savedScrollTop;
            }, 0);
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) redo();
                    else undo();
                    break;
                case 'y':
                    e.preventDefault();
                    redo();
                    break;
                case 'b':
                    e.preventDefault();
                    handleBold();
                    break;
                case 'i':
                    e.preventDefault();
                    handleItalic();
                    break;
                case 'u':
                    e.preventDefault();
                    handleUnderline();
                    break;
            }
        }

        // Escape to close AI input
        if (e.key === 'Escape') {
            if (showAiInput) {
                setShowAiInput(false);
                setShowAiPopup(false);
            }
        }
    };

    // ── Render the text with edit indicators (FIX #4: visible highlight) ─────

    const renderedSegments = useMemo(() => {
        if (editRegions.length === 0) return null;

        // Sort regions by start offset
        const sorted = [...editRegions].sort((a, b) => a.startOffset - b.startOffset);
        const segments: { text: string; isEdited: boolean }[] = [];
        let cursor = 0;

        for (const region of sorted) {
            if (region.startOffset > cursor) {
                segments.push({ text: text.substring(cursor, region.startOffset), isEdited: false });
            }
            segments.push({ text: text.substring(region.startOffset, region.endOffset), isEdited: true });
            cursor = region.endOffset;
        }

        if (cursor < text.length) {
            segments.push({ text: text.substring(cursor), isEdited: false });
        }

        return segments;
    }, [text, editRegions]);

    // ── Close on Escape key at document level ────────────────────────────────

    useEffect(() => {
        const handler = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape' && !showAiInput && !aiLoading) {
                onCancel();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onCancel, showAiInput, aiLoading]);

    // ── AI popup — rendered inline inside the editor body (absolute, not fixed) ──

    const aiPopupInline = (showAiPopup || showAiInput) ? (
        <AnimatePresence>
            <motion.div
                ref={popupRef}
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="absolute z-[10] flex flex-col gap-1.5 pointer-events-auto"
                style={{ left: popupContentPos.x, top: popupContentPos.y }}
            >
                {!showAiInput ? (
                    // Icon-only sparkle button — orange brand color
                    <button
                        onMouseDown={(e) => e.preventDefault()} // Prevent focus theft
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAiInput(true);
                            setTimeout(() => aiInputRef.current?.focus(), 50);
                        }}
                        className="p-1.5 rounded-lg
                            bg-orange-500/20 border border-orange-500/30
                            text-orange-400
                            shadow-lg shadow-orange-500/20
                            hover:bg-orange-500/30 hover:text-orange-300
                            transition-all backdrop-blur-sm"
                        title="AI Edit"
                    >
                        <Sparkles size={14} />
                    </button>
                ) : (
                    // Edit instruction input — orange-themed
                    <div className="flex items-center gap-1.5 p-1.5 rounded-md
                        bg-[#0c0c0c]/95 border border-orange-500/30
                        shadow-xl shadow-orange-500/15 backdrop-blur-xl"
                        style={{ minWidth: 320 }}
                    >
                        <Sparkles size={13} className="text-orange-400 ml-2 shrink-0" />
                        <input
                            ref={aiInputRef}
                            type="text"
                            value={aiInstruction}
                            onChange={(e) => setAiInstruction(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAiEdit();
                                }
                                if (e.key === 'Escape') {
                                    setShowAiInput(false);
                                    setShowAiPopup(false);
                                    textareaRef.current?.focus();
                                }
                                e.stopPropagation();
                            }}
                            placeholder="Describe your edit..."
                            disabled={aiLoading}
                            className="flex-1 bg-transparent outline-none text-xs font-mono
                                text-white/90 placeholder:text-white/30 py-1.5"
                        />
                        <button
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleAiEdit}
                            disabled={aiLoading || !aiInstruction.trim()}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                                bg-orange-500/20 text-orange-400 text-[11px] font-mono
                                hover:bg-orange-500/30 transition-all
                                disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {aiLoading ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <Send size={11} />
                            )}
                        </button>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    ) : null;

    // ─── Render ──────────────────────────────────────────────────────────────

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex flex-col backdrop-blur-md"
            style={{
                background: 'linear-gradient(160deg, #140c06 0%, #12090a 30%, #100a0e 60%, #0e0906 100%)',
            }}
        >
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold text-white/90">{fileName}</span>
                        {isDirty && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                EDITED
                            </span>
                        )}
                    </div>
                    {filePath && (
                        <span className="text-[10px] font-mono text-white/20 truncate max-w-[400px]">{filePath}</span>
                    )}
                </div>
                <button
                    onClick={onCancel}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-all"
                >
                    <X size={18} />
                </button>
            </div>

            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-0.5 px-5 py-2 border-b border-white/5 bg-white/[0.02]">
                <ToolbarButton icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} disabled={historyIndex <= 0} />
                <ToolbarButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={historyIndex >= history.length - 1} />
                <ToolbarDivider />
                <ToolbarButton icon={Bold} label="Bold (Ctrl+B)" onClick={handleBold} />
                <ToolbarButton icon={Italic} label="Italic (Ctrl+I)" onClick={handleItalic} />
                <ToolbarButton icon={Underline} label="Underline (Ctrl+U)" onClick={handleUnderline} />
                <ToolbarButton icon={Strikethrough} label="Strikethrough" onClick={handleStrikethrough} />
                <ToolbarDivider />
                <ToolbarButton icon={Quote} label="Block Quote" onClick={handleQuote} />
                <ToolbarButton icon={List} label="Bullet List" onClick={handleBullet} />
                <ToolbarDivider />
                <div className="flex items-center gap-1.5 ml-2 text-[10px] font-mono text-white/25">
                    <Sparkles size={11} className="text-orange-400/50" />
                    Select text for AI editing
                </div>

                {/* Edit region count */}
                {editRegions.length > 0 && (
                    <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-amber-400/70">
                        <div className="w-2 h-2 rounded-full bg-amber-400/60" />
                        {editRegions.length} edit{editRegions.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            {/* ── Editor body ─────────────────────────────────────────── */}
            <div ref={editorBodyRef} className="flex-1 relative overflow-hidden">
                {/* Highlight overlay — synced scrolling, visible backgrounds for edited / AI-loading regions */}
                <div
                    ref={highlightRef}
                    className="absolute inset-0 px-5 py-4 overflow-y-auto pointer-events-none"
                    style={{ scrollBehavior: 'auto', position: 'absolute' }}
                >
                    {/* Wrapper with relative positioning so the AI popup can be absolutely positioned within scrollable content */}
                    <div style={{ position: 'relative' }}>
                        <pre
                            className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words"
                            style={{ color: 'transparent', margin: 0 }}
                        >
                            {(() => {
                                // Build segments: edit regions + AI-loading region
                                const allRegions: { start: number; end: number; type: 'edit' | 'ai-loading' }[] = [];

                                // Add completed edit regions
                                editRegions.forEach(r => {
                                    allRegions.push({ start: r.startOffset, end: r.endOffset, type: 'edit' });
                                });

                                // Add currently-loading AI region
                                if (aiLoading && selectionRange) {
                                    allRegions.push({ start: selectionRange.start, end: selectionRange.end, type: 'ai-loading' });
                                }

                                if (allRegions.length === 0) return text;

                                // Sort by start offset
                                allRegions.sort((a, b) => a.start - b.start);

                                const segs: ReactElement[] = [];
                                let cursor = 0;

                                allRegions.forEach((region, i) => {
                                    if (region.start > cursor) {
                                        segs.push(<span key={`gap-${i}`}>{text.substring(cursor, region.start)}</span>);
                                    }
                                    if (region.type === 'ai-loading') {
                                        segs.push(
                                            <span
                                                key={`ai-${i}`}
                                                style={{
                                                    backgroundColor: 'rgba(249, 115, 22, 0.18)',
                                                    borderRadius: '2px',
                                                    position: 'relative',
                                                    display: 'inline',
                                                }}
                                            >
                                                {text.substring(region.start, region.end)}
                                            </span>
                                        );
                                    } else {
                                        segs.push(
                                            <span
                                                key={`edit-${i}`}
                                                style={{
                                                    backgroundColor: 'rgba(251, 191, 36, 0.12)',
                                                    borderLeft: '2px solid rgba(251, 191, 36, 0.5)',
                                                    paddingLeft: '2px',
                                                    marginLeft: '-3px',
                                                    borderRadius: '2px',
                                                }}
                                            >
                                                {text.substring(region.start, region.end)}
                                            </span>
                                        );
                                    }
                                    cursor = region.end;
                                });

                                if (cursor < text.length) {
                                    segs.push(<span key="tail">{text.substring(cursor)}</span>);
                                }

                                return segs;
                            })()}
                        </pre>

                        {/* AI popup — inside scrolling overlay so it scrolls inline with text */}
                        {aiPopupInline}
                    </div>
                </div>

                {/* Textarea on top — transparent background so highlights show through */}
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onScroll={handleScroll}
                    className={cn(
                        'absolute inset-0 w-full h-full resize-none px-5 py-4',
                        'bg-transparent text-xs font-mono leading-relaxed text-white/85',
                        'placeholder:text-white/20',
                        'focus:outline-none',
                        'caret-orange-400',
                    )}
                    placeholder="Start typing..."
                    spellCheck={false}
                    autoFocus
                />

                {/* Inline AI loading spinner — positioned near selection */}
                {aiLoading && selectionRange && (
                    <AiLoadingSpinner textareaRef={textareaRef} selectionEnd={selectionRange.end} text={text} />
                )}

            </div>

            {/* ── Footer ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/8">
                <div className="text-[10px] font-mono text-white/20">
                    {text.length.toLocaleString()} chars · {text.split('\n').length} lines
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onCancel}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono
                            text-white/50 border border-white/10 bg-transparent
                            hover:bg-white/5 hover:text-white/80 transition-all"
                    >
                        <RotateCcw size={12} />
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(text)}
                        className={cn(
                            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono transition-all',
                            isDirty
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)]'
                                : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                        )}
                        disabled={!isDirty}
                    >
                        <Check size={13} />
                        Confirm Changes
                    </button>
                </div>
            </div>


        </motion.div>,
        document.body
    );
}
