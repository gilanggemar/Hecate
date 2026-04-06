"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePentagramChatStore, type ChatMessage } from "@/stores/usePentagramChatStore";
import { usePentagramStore } from "@/stores/usePentagramStore";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare, X, Send, Trash2, Save, FolderOpen,
    Settings2, Loader2, Eye, EyeOff, ChevronLeft
} from "lucide-react";

// ─── Simple Markdown Renderer ────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
    // Process line by line
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, i) => {
        // Process inline formatting
        let processed = line;

        // Bold + italic
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        
        // Use regex to find formatting patterns
        const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|__(.+?)__|_(.+?)_)/g;
        let match;

        while ((match = regex.exec(processed)) !== null) {
            // Add text before match
            if (match.index > lastIndex) {
                parts.push(processed.slice(lastIndex, match.index));
            }

            if (match[2]) {
                // ***bold italic***
                parts.push(<strong key={`${i}-${match.index}`}><em>{match[2]}</em></strong>);
            } else if (match[3]) {
                // **bold**
                parts.push(<strong key={`${i}-${match.index}`} className="font-bold text-white">{match[3]}</strong>);
            } else if (match[4]) {
                // *italic*
                parts.push(<em key={`${i}-${match.index}`} className="italic text-white/80">{match[4]}</em>);
            } else if (match[5]) {
                // `code`
                parts.push(<code key={`${i}-${match.index}`} className="px-1 py-0.5 bg-white/10 rounded text-[11px] font-mono text-emerald-300">{match[5]}</code>);
            } else if (match[6]) {
                // __underline as bold__
                parts.push(<strong key={`${i}-${match.index}`} className="font-bold text-white">{match[6]}</strong>);
            } else if (match[7]) {
                // _italic_
                parts.push(<em key={`${i}-${match.index}`} className="italic text-white/80">{match[7]}</em>);
            }

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < processed.length) {
            parts.push(processed.slice(lastIndex));
        }

        if (parts.length === 0) {
            parts.push(processed);
        }

        elements.push(
            <span key={i}>
                {parts}
                {i < lines.length - 1 && <br />}
            </span>
        );
    });

    return <>{elements}</>;
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────

function ChatBubble({ message, agentName, agentColor }: {
    message: ChatMessage;
    agentName: string;
    agentColor: string;
}) {
    const isUser = message.role === 'user';

    return (
        <motion.div
            initial={{ opacity: 0, y: 6, x: isUser ? 8 : -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ duration: 0.25 }}
            className={cn("flex mb-2.5", isUser ? "justify-end" : "justify-start")}
        >
            <div
                className={cn(
                    "max-w-[95%] rounded-2xl px-3.5 py-2 text-[13px] leading-[1.4] backdrop-blur-sm",
                    isUser
                        ? "bg-black/60 backdrop-blur-md text-white/90 rounded-br-md border border-white/[0.06]"
                        : "bg-black/70 backdrop-blur-md text-white/85 rounded-bl-md border"
                )}
                style={!isUser ? { borderColor: `${agentColor}25` } : undefined}
            >
                {!isUser && (
                    <span
                        className="text-[9px] font-black uppercase tracking-[0.15em] block mb-0.5"
                        style={{ color: agentColor }}
                    >
                        {agentName}
                    </span>
                )}
                <div className="whitespace-pre-wrap">{renderMarkdown(message.content)}</div>
                <span className={cn(
                    "text-[8px] mt-0.5 block font-mono",
                    isUser ? "text-white/20 text-right" : "text-white/15"
                )}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </motion.div>
    );
}

// ─── Streaming Bubble ────────────────────────────────────────────────────────

function StreamingBubble({ content, agentName, agentColor }: {
    content: string;
    agentName: string;
    agentColor: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            className="flex mb-2.5 justify-start"
        >
            <div
                className="max-w-[95%] rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px] leading-[1.4] bg-black/70 backdrop-blur-md border"
                style={{ borderColor: `${agentColor}25` }}
            >
                <span
                    className="text-[9px] font-black uppercase tracking-[0.15em] block mb-0.5"
                    style={{ color: agentColor }}
                >
                    {agentName}
                </span>
                <div className="whitespace-pre-wrap text-white/85">{content ? renderMarkdown(content) : '...'}</div>
                <span className="flex items-center gap-1 text-[8px] text-white/15 mt-0.5 font-mono">
                    <Loader2 className="w-2 h-2 animate-spin" /> typing
                </span>
            </div>
        </motion.div>
    );
}

// ─── Settings Overlay ────────────────────────────────────────────────────────

function SettingsOverlay({ onClose }: { onClose: () => void }) {
    const gossipFrequency = usePentagramChatStore(s => s.gossipFrequency);
    const setGossipFrequency = usePentagramChatStore(s => s.setGossipFrequency);
    const characters = usePentagramChatStore(s => s.characters);
    const toggleVis = usePentagramChatStore(s => s.toggleCharacterVisibility);

    const labels: Record<string, string> = {
        '0.1': 'Subtle',
        '0.2': 'Cautious',
        '0.4': 'Active',
        '0.6': 'Chatty',
        '0.8': 'Chaotic',
        '1.0': 'Omniscient',
    };

    const closest = Object.keys(labels).reduce((prev, curr) =>
        Math.abs(parseFloat(curr) - gossipFrequency) < Math.abs(parseFloat(prev) - gossipFrequency) ? curr : prev
    );

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md rounded-2xl p-4 flex flex-col overflow-y-auto"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50">Settings</h3>
                <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="mb-5">
                <label className="text-[9px] uppercase tracking-wider text-orange-400/70 font-mono mb-1.5 block">
                    Gossip Frequency — {Math.round(gossipFrequency * 100)}%
                </label>
                <input
                    type="range" min="0" max="1" step="0.05"
                    value={gossipFrequency}
                    onChange={(e) => setGossipFrequency(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                />
                <span className="text-[9px] text-orange-400/50 mt-0.5 block">{labels[closest] || 'Custom'}</span>
            </div>

            <div>
                <label className="text-[9px] uppercase tracking-wider text-cyan-400/70 font-mono mb-1.5 block">Characters</label>
                <div className="space-y-1">
                    {characters.map(c => (
                        <button
                            key={c.id}
                            onClick={() => toggleVis(c.id)}
                            className={cn(
                                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] transition-all",
                                c.hidden ? "text-white/25" : "text-white/70"
                            )}
                        >
                            {c.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" style={{ color: c.colorHex }} />}
                            <span>{c.name}</span>
                        </button>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

// ─── Save/Load Overlay ───────────────────────────────────────────────────────

function SaveLoadOverlay({
    onClose, onSave, onLoad
}: {
    onClose: () => void;
    onSave: (name: string) => void;
    onLoad: (saveId: string) => void;
}) {
    const saves = usePentagramChatStore(s => s.saves);
    const loadSaves = usePentagramChatStore(s => s.loadSaves);
    const saveId = usePentagramStore(s => s.saveId);
    const deleteSave = usePentagramChatStore(s => s.deleteSave);
    const [saveName, setSaveName] = useState('');
    const [confirmLoadId, setConfirmLoadId] = useState<string | null>(null);

    useEffect(() => { loadSaves(); }, [loadSaves]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md rounded-2xl p-4 flex flex-col overflow-y-auto"
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50">Save / Load</h3>
                <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="flex gap-2 mb-3">
                <input
                    type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                    placeholder="Save name..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/25 focus:border-emerald-500 focus:outline-none"
                />
                <button
                    onClick={() => { if (saveName.trim()) { onSave(saveName.trim()); setSaveName(''); } }}
                    disabled={!saveName.trim()}
                    className="px-2.5 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold hover:bg-emerald-500/30 disabled:opacity-30 transition-all flex items-center gap-1"
                >
                    <Save className="w-3 h-3" /> Save
                </button>
            </div>

            <div className="space-y-1.5 flex-1">
                {saves.length === 0 && <p className="text-[10px] text-white/20 text-center py-4 font-mono">No saves</p>}
                {saves.map(s => (
                    <div key={s.id} className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-white/70 truncate">{s.save_name}</div>
                            <div className="text-[9px] text-white/25 font-mono">{new Date(s.updated_at).toLocaleString()}</div>
                        </div>
                        {confirmLoadId === s.id ? (
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-rose-400">Overwrite?</span>
                                <button onClick={() => { onLoad(s.id); setConfirmLoadId(null); }} className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[9px]">Yes</button>
                                <button onClick={() => setConfirmLoadId(null)} className="px-1.5 py-0.5 bg-white/5 text-white/40 rounded text-[9px]">No</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => setConfirmLoadId(s.id)} className="p-1 text-cyan-400/60 hover:text-cyan-400 rounded" title="Load"><FolderOpen className="w-3 h-3" /></button>
                                <button onClick={() => { if (confirm('Delete?')) deleteSave(s.id); }} className="p-1 text-rose-400/30 hover:text-rose-400 rounded" title="Delete"><Trash2 className="w-3 h-3" /></button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

// ─── Main Chat Panel ─────────────────────────────────────────────────────────

interface PentagramChatPanelProps {
    onSaveGame: (saveName: string) => void;
    onLoadGame: (saveId: string) => Promise<void>;
}

export function PentagramChatPanel({ onSaveGame, onLoadGame }: PentagramChatPanelProps) {
    const {
        characters, activeCharacterId, conversations,
        isStreaming, streamingContent,
        setActiveCharacter, clearConversation, sendMessage,
    } = usePentagramChatStore();

    const [input, setInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showSaveLoad, setShowSaveLoad] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const visibleChars = characters.filter(c => !c.hidden);

    useEffect(() => {
        if (!activeCharacterId && visibleChars.length > 0) {
            setActiveCharacter(visibleChars[0].id);
        }
    }, [activeCharacterId, visibleChars, setActiveCharacter]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations, activeCharacterId, streamingContent]);

    const activeChar = characters.find(c => c.id === activeCharacterId);
    const activeMessages = activeCharacterId ? (conversations[activeCharacterId] || []) : [];

    const handleSend = useCallback(() => {
        if (!input.trim() || isStreaming) return;
        const store = usePentagramStore.getState();
        const gameCtx = {
            game: 'pentagram_protocol',
            current_scene_id: store.currentSceneId,
            scene_title: '',
            scene_narrative: '',
            game_state: store.gameState,
        };
        sendMessage(input.trim(), gameCtx);
        setInput('');
    }, [input, isStreaming, sendMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Removed collapsed state per user request

    // ─── Open: centered floating panel ─────────────────────────────────

    return (
        <>
        {/* Left corner tools */}
        {/* Left corner tools */}
        <div className="absolute left-4 bottom-4 z-40 flex flex-col items-center gap-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-1.5 py-3 pointer-events-auto shadow-2xl w-[52px]">
            <button onClick={() => setShowSaveLoad(true)} className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-all" title="Save/Load">
                <Save className="w-4 h-4" />
            </button>
            <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-orange-400 hover:bg-white/5 rounded-lg transition-all" title="Settings">
                <Settings2 className="w-4 h-4" />
            </button>
            {activeCharacterId && (
                <button
                    onClick={() => { if (confirm(`Clear chat with ${activeChar?.name}?\nMemories will be kept.`)) clearConversation(activeCharacterId); }}
                    className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-all" title="Clear history"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>

        <motion.div
            initial={{ opacity: 0, x: "-50%", y: 20 }}
            animate={{ opacity: 1, x: "-50%", y: 0 }}
            exit={{ opacity: 0, x: "-50%", y: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-[60px] bottom-4 z-40 pointer-events-auto flex flex-col"
            style={{ width: '45%', minWidth: 380, maxWidth: 640, left: '26%' }}
        >
            <div className="w-full h-full flex flex-col relative">

                {/* Overlays */}
                <AnimatePresence>
                    {showSettings && <SettingsOverlay onClose={() => setShowSettings(false)} />}
                    {showSaveLoad && (
                        <SaveLoadOverlay
                            onClose={() => setShowSaveLoad(false)}
                            onSave={(name) => { onSaveGame(name); setShowSaveLoad(false); }}
                            onLoad={async (id) => { await onLoadGame(id); setShowSaveLoad(false); }}
                        />
                    )}
                </AnimatePresence>

                {/* Top Controls Removed (now at bottom left of screen) */}

                {/* ─── Messages (floating bubbles, no background) ────────── */}
                <div className="flex-1 overflow-y-auto px-1 pb-2 scrollbar-hide">
                    {activeMessages.length === 0 && !isStreaming && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <p className="text-[11px] text-white/20 font-mono">
                                {activeChar ? `Talk to ${activeChar.name}...` : 'Select a character'}
                            </p>
                            <p className="text-[9px] text-white/10 mt-1 italic">
                                They remember everything.
                            </p>
                        </div>
                    )}

                    {activeMessages.map(msg => (
                        <ChatBubble
                            key={msg.id}
                            message={msg}
                            agentName={activeChar?.name || 'Agent'}
                            agentColor={activeChar?.colorHex || '#666'}
                        />
                    ))}

                    {isStreaming && (
                        <StreamingBubble
                            content={streamingContent}
                            agentName={activeChar?.name || 'Agent'}
                            agentColor={activeChar?.colorHex || '#666'}
                        />
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* ─── Input (floating at bottom) ────────────────────────── */}
                <div className="flex-shrink-0 px-1 pb-1">
                    <div className="flex items-end gap-2 bg-black/40 backdrop-blur-md rounded-2xl px-3 py-2 border border-white/[0.06]">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={activeChar ? `Message ${activeChar.name}...` : 'Select a character...'}
                            disabled={!activeCharacterId || isStreaming}
                            rows={1}
                            className="flex-1 bg-transparent text-[13px] text-white/90 placeholder-white/20 resize-none focus:outline-none disabled:opacity-30 max-h-20 overflow-y-auto scrollbar-hide"
                            style={{ minHeight: '24px' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || !activeCharacterId || isStreaming}
                            className={cn(
                                "p-1.5 rounded-xl transition-all flex-shrink-0",
                                input.trim() && activeCharacterId && !isStreaming
                                    ? "text-white/70 hover:text-white hover:bg-white/10"
                                    : "text-white/15 cursor-not-allowed"
                            )}
                        >
                            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
        </>
    );
}
