'use client';

import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { usePromptChunkStore } from '@/store/usePromptChunkStore';
import { InsertedChunkBadge } from './InsertedChunkBadge';
import { createRoot } from 'react-dom/client';

interface ChatInputWithChunksProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    value?: string | number | readonly string[];
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSend?: (e: React.FormEvent) => void;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
}

export const ChatInputWithChunks = forwardRef<HTMLDivElement, ChatInputWithChunksProps>(
    ({ value, onChange, onSend, className, placeholder, disabled, rows, ...props }, ref) => {
        const { chunks } = usePromptChunkStore();
        const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
        const localDivRef = useRef<HTMLDivElement | null>(null);

        const rootsRef = useRef<Map<Element, any>>(new Map());
        const lastParsedValueRef = useRef<string>((value as string) || '');
        const isComposingRef = useRef(false);

        const handleRef = (node: HTMLDivElement) => {
            localDivRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement>).current = node;
        };

        const renderBadges = () => {
            if (!localDivRef.current) return;
            const tokens = localDivRef.current.querySelectorAll('.chunk-token');

            tokens.forEach(token => {
                let root = rootsRef.current.get(token);
                if (!root) {
                    root = createRoot(token);
                    rootsRef.current.set(token, root);
                }

                const chunkId = token.getAttribute('data-id');
                const chunk = chunks.find(c => c.id === chunkId);

                if (chunk) {
                    const isExpanded = expandedTokens.has(chunk.id);
                    root.render(
                        <InsertedChunkBadge
                            chunk={chunk}
                            expanded={isExpanded}
                            onDoubleClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setExpandedTokens(prev => {
                                    const next = new Set(prev);
                                    if (next.has(chunk.id)) next.delete(chunk.id);
                                    else next.add(chunk.id);
                                    return next;
                                });
                            }}
                        />
                    );
                }
            });

            // Cleanup removed tokens
            for (const [token, root] of Array.from(rootsRef.current.entries())) {
                if (!localDivRef.current.contains(token)) {
                    // Slight delay to allow React to finish if we are in render phase
                    setTimeout(() => root.unmount(), 0);
                    rootsRef.current.delete(token);
                }
            }
        };

        const updateDOMFromValue = (val: string) => {
            if (!localDivRef.current) return;

            let html = val.replace(/⟦([^⟧]+)⟧/g, (match, name) => {
                const chunk = chunks.find(c => c.name === name);
                if (!chunk) return match;
                return `<span class="chunk-token inline-block mx-0.5 align-middle select-none cursor-grab active:cursor-grabbing" contenteditable="false" draggable="true" data-id="${chunk.id}" data-name="${chunk.name}"></span>`;
            });

            html = html.replace(/\n/g, '<br>');
            localDivRef.current.innerHTML = html;
            renderBadges();
        };

        // When external value changes, sync the DOM
        useEffect(() => {
            const valStr = (value as string) || '';
            if (valStr !== lastParsedValueRef.current) {
                updateDOMFromValue(valStr);
                lastParsedValueRef.current = valStr;
            }
        }, [value]);

        // Listen for prompt chunk insertions from the tray pill CustomEvent
        useEffect(() => {
            const handleInsertEvent = (e: Event) => {
                const customEvent = e as CustomEvent<{ id: string }>;
                const chunk = chunks.find(c => c.id === customEvent.detail.id);
                if (!chunk || disabled || !localDivRef.current) return;

                localDivRef.current.focus();

                // Build the chunk span element directly
                const span = document.createElement('span');
                span.className = 'chunk-token inline-block mx-0.5 align-middle select-none cursor-grab active:cursor-grabbing';
                span.contentEditable = 'false';
                span.draggable = true;
                span.setAttribute('data-id', chunk.id);
                span.setAttribute('data-name', chunk.name);

                const spacer = document.createTextNode('\u200B');

                const sel = window.getSelection();
                let range: Range | null = null;

                // Use existing caret position if available
                if (sel && sel.rangeCount > 0) {
                    range = sel.getRangeAt(0);
                    // Verify the range is inside our input
                    if (!localDivRef.current.contains(range.commonAncestorContainer)) {
                        range = null;
                    }
                }

                if (range) {
                    // Insert at the current caret position
                    range.collapse(false);
                    range.insertNode(spacer);
                    range.insertNode(span);

                    // Move caret to after the spacer
                    const newRange = document.createRange();
                    newRange.setStartAfter(spacer);
                    newRange.collapse(true);
                    sel!.removeAllRanges();
                    sel!.addRange(newRange);
                } else {
                    // Fallback: append to end
                    localDivRef.current.appendChild(span);
                    localDivRef.current.appendChild(spacer);

                    // Move caret to after spacer
                    if (sel) {
                        const newRange = document.createRange();
                        newRange.setStartAfter(spacer);
                        newRange.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(newRange);
                    }
                }

                handleInput();
            };

            window.addEventListener('insert-prompt-chunk', handleInsertEvent);
            return () => window.removeEventListener('insert-prompt-chunk', handleInsertEvent);
        }, [chunks, disabled]);

        // When expanded tokens change, trigger re-render of badges
        useEffect(() => {
            renderBadges();
        }, [expandedTokens, chunks]);

        const parseToText = (element: HTMLElement) => {
            let result = '';
            let isFirstNode = true;
            const traverse = (node: Node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    result += node.textContent?.replace(/\u200B/g, '') || '';
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node as HTMLElement;
                    if (el.classList.contains('chunk-token')) {
                        const name = el.getAttribute('data-name');
                        if (name) result += `⟦${name}⟧`;
                    } else if (el.tagName === 'BR') {
                        result += '\n';
                    } else if (el.tagName === 'DIV' || el.tagName === 'P') {
                        if (!isFirstNode) result += '\n'; // prevent leading newline from first block
                        Array.from(node.childNodes).forEach(traverse);
                    } else {
                        Array.from(node.childNodes).forEach(traverse);
                    }
                }
                isFirstNode = false;
            };
            Array.from(element.childNodes).forEach(traverse);

            return result.replace(/^\n/, ''); // Clean leading
        };

        const handleInput = () => {
            if (!localDivRef.current || isComposingRef.current) return;

            const newText = parseToText(localDivRef.current);
            lastParsedValueRef.current = newText;

            if (onChange) {
                onChange({ target: { value: newText }, currentTarget: { value: newText } } as any);
            }



            renderBadges();
        };

        const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
            const target = e.target as HTMLElement;
            if (target && target.classList?.contains('chunk-token')) {
                const id = target.getAttribute('data-id');
                const name = target.getAttribute('data-name') || 'Chunk';
                if (id) {
                    e.dataTransfer.setData('application/x-prompt-chunk-id-internal', id);
                    e.dataTransfer.effectAllowed = 'move';
                    target.classList.add('is-dragging');
                    (window as any).__draggingChunkName = name;
                    (window as any).__draggingChunkColor = '#6B7280'; // Default gray for internal for now
                }
            }
        };

        const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
            if (localDivRef.current) {
                const draggingNode = localDivRef.current.querySelector('.is-dragging');
                if (draggingNode) draggingNode.classList.remove('is-dragging');
                const existingPlaceholder = localDivRef.current.querySelector('.chunk-drop-placeholder');
                if (existingPlaceholder) existingPlaceholder.remove();
            }
        };

        const handleDragOver = (e: React.DragEvent) => {
            e.preventDefault();

            if (disabled) return;

            // Only care about valid prompt chunks
            if (!e.dataTransfer.types.includes('application/x-prompt-chunk-id') &&
                !e.dataTransfer.types.includes('application/x-prompt-chunk-id-internal')) {
                return;
            }

            localDivRef.current?.focus();

            let range;
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(e.clientX, e.clientY);
            } else if ((e as any).rangeParent) {
                range = document.createRange();
                range.setStart((e as any).rangeParent, (e as any).rangeOffset);
            }

            if (range) {
                const sel = window.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        };

        const handleDragLeave = (e: React.DragEvent) => {
            // No longer need to remove placeholder as handleDragOver won't create it
        };

        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (disabled) return;

            let chunkId = e.dataTransfer.getData('application/x-prompt-chunk-id');
            const isInternal = !chunkId;

            if (isInternal) {
                chunkId = e.dataTransfer.getData('application/x-prompt-chunk-id-internal');
            }

            if (!chunkId) return;

            const chunk = chunks.find(c => c.id === chunkId);
            if (!chunk) return;

            if (!localDivRef.current) return;
            localDivRef.current.focus();

            // Get precise caret position from drop coordinates
            let range: Range | null = null;
            if (document.caretRangeFromPoint) {
                range = document.caretRangeFromPoint(e.clientX, e.clientY);
            } else if ((e as any).rangeParent) {
                range = document.createRange();
                range.setStart((e as any).rangeParent, (e as any).rangeOffset);
            }

            // If it's an internal move, remove the original node first
            if (isInternal && localDivRef.current) {
                const draggingNode = localDivRef.current.querySelector('.is-dragging');
                if (draggingNode) {
                    draggingNode.remove();
                }
            }

            // Build the chunk span element directly
            const span = document.createElement('span');
            span.className = 'chunk-token inline-block mx-0.5 align-middle select-none cursor-grab active:cursor-grabbing';
            span.contentEditable = 'false';
            span.draggable = true;
            span.setAttribute('data-id', chunk.id);
            span.setAttribute('data-name', chunk.name);

            // Create a zero-width space after the chunk for caret positioning
            const spacer = document.createTextNode('\u200B');

            if (range) {
                // Insert at the precise caret position using DOM APIs
                range.collapse(true);
                range.insertNode(spacer);
                range.insertNode(span);

                // Move caret to after the spacer
                const sel = window.getSelection();
                if (sel) {
                    const newRange = document.createRange();
                    newRange.setStartAfter(spacer);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
            } else {
                // Fallback: append to end
                localDivRef.current.appendChild(span);
                localDivRef.current.appendChild(spacer);
            }

            handleInput();
        };

        const handlePaste = (e: React.ClipboardEvent) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (onSend) onSend(e as unknown as React.FormEvent);
                if (localDivRef.current) localDivRef.current.innerHTML = '';
            }
            if (props.onKeyDown) props.onKeyDown(e);
        };

        // For placeholder styling
        const isEmpty = !value || (value as string).trim() === '';

        // Clean up React props that shouldn't go to div natively
        const divProps = { ...props };
        delete (divProps as any).onInput; // we intercept it natively

        return (
            <div className="relative w-full h-full">
                {isEmpty && placeholder && (
                    <div
                        className={`absolute inset-0 pointer-events-none text-muted-foreground select-none overflow-hidden whitespace-nowrap opacity-50 ${className || ''}`}
                        style={{ backgroundColor: 'transparent', resize: 'none' }}
                    >
                        {placeholder}
                    </div>
                )}
                <div
                    {...divProps}
                    ref={handleRef}
                    contentEditable={!disabled}
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onCompositionStart={() => { isComposingRef.current = true; }}
                    onCompositionEnd={() => { isComposingRef.current = false; handleInput(); }}
                    className={`block w-full h-full bg-transparent outline-none overflow-y-auto relative z-10 caret-foreground selection:bg-foreground/20 whitespace-pre-wrap break-words ${className || ''}`}
                    style={{ minHeight: rows ? `${rows * 1.5}rem` : '40px' }}
                />
            </div>
        );
    }
);

ChatInputWithChunks.displayName = 'ChatInputWithChunks';
