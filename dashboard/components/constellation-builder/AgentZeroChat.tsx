'use client';

// AgentZeroChat.tsx
// Floating chat panel for Agent Zero assistance on the constellation canvas.
// Helps users design agent configurations by consulting Agent Zero.

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { useConstellationStore } from '@/store/useConstellationStore';
import { AGENT_DEFAULTS } from '@/lib/constellation/agentSchema';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export function AgentZeroChat() {
    const {
        zeroChatOpen,
        zeroChatTargetAgent,
        agents,
        toggleZeroChat,
    } = useConstellationStore();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (zeroChatOpen && !minimized) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [zeroChatOpen, minimized]);

    // Get target agent context
    const targetAgent = zeroChatTargetAgent ? agents[zeroChatTargetAgent] : null;
    const targetDefaults = zeroChatTargetAgent ? AGENT_DEFAULTS[zeroChatTargetAgent] : null;

    const handleSend = useCallback(async () => {
        if (!input.trim() || isThinking) return;

        const userMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: input.trim(),
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);

        // Build context about the target agent
        const agentContext = targetAgent
            ? `The user is currently working on the agent "${targetAgent.name}" (codename: ${targetAgent.codename}, role: ${targetAgent.executiveRole}).
Current state:
- Mission: ${targetAgent.roleCharter.mission || '(not yet defined)'}
- Boundaries owns: ${targetAgent.boundaries.owns.join(', ') || '(none)'}
- Build score: ${Math.round((Object.values(targetAgent.buildScore).reduce((a, b) => a + b, 0) / 35) * 100)}%
- Files: ${targetAgent.files.map(f => f.name).join(', ') || '(none loaded)'}

Help the user design and refine this agent's configuration.`
            : 'The user is designing their OpenClaw agent architecture. Help them with agent roles, boundaries, doctrine, and operational protocols.';

        try {
            // Try to send to Agent Zero via the OpenClaw gateway
            const { getGateway } = await import('@/lib/openclawGateway');
            const gw = getGateway();

            if (gw.isConnected) {
                // Try to use Agent Zero for the response
                const response = await gw.request('chat.send', {
                    agentId: 'agent-zero',
                    message: `[CONSTELLATION CONTEXT]\n${agentContext}\n\n[USER QUESTION]\n${userMsg.content}`,
                }).catch(() => null);

                const assistantContent = response?.message || response?.content || response?.text
                    || 'I received your message but the gateway did not return a response. Please check the Agent Zero connection.';

                setMessages(prev => [...prev, {
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: Date.now(),
                }]);
            } else {
                // Offline fallback
                setMessages(prev => [...prev, {
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: 'Agent Zero is not currently connected. Please ensure the OpenClaw Gateway is running and connected to use this feature.',
                    timestamp: Date.now(),
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: 'Failed to reach Agent Zero. The gateway may be unavailable.',
                timestamp: Date.now(),
            }]);
        } finally {
            setIsThinking(false);
        }
    }, [input, isThinking, targetAgent]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!zeroChatOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                key="zero-chat"
                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 20, opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-4 left-4 z-50 flex flex-col rounded-lg border border-[#38bdf8]/20 overflow-hidden shadow-2xl"
                style={{
                    width: minimized ? 280 : 380,
                    height: minimized ? 48 : 480,
                    background: 'rgba(8, 8, 14, 0.95)',
                    backdropFilter: 'blur(24px)',
                    boxShadow: `0 0 40px rgba(56,189,248,0.08), 0 20px 60px rgba(0,0,0,0.5)`,
                    transition: 'width 0.3s, height 0.3s',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#38bdf8] shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
                        <span className="text-xs font-mono font-bold text-[#38bdf8]/80 tracking-wider">
                            AGENT ZERO
                        </span>
                        {targetAgent && (
                            <span className="text-[9px] font-mono text-white/25">
                                • {targetAgent.name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setMinimized(!minimized)}
                            className="p-1 text-white/30 hover:text-white/60 transition-colors"
                        >
                            {minimized ? <Maximize2 className="size-3" /> : <Minimize2 className="size-3" />}
                        </button>
                        <button
                            onClick={() => toggleZeroChat()}
                            className="p-1 text-white/30 hover:text-white/60 transition-colors"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                </div>

                {!minimized && (
                    <>
                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                    <Bot className="size-8 text-[#38bdf8]/20" />
                                    <div>
                                        <p className="text-xs font-mono text-white/30">
                                            Ask Agent Zero for help
                                        </p>
                                        <p className="text-[9px] font-mono text-white/15 mt-1">
                                            {targetAgent
                                                ? `Currently focused on ${targetAgent.name} (${targetAgent.codename})`
                                                : 'Design agent roles, frameworks, boundaries'
                                            }
                                        </p>
                                    </div>
                                </div>
                            )}

                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] px-3 py-2 rounded-sm text-xs font-mono leading-relaxed
                                            ${msg.role === 'user'
                                                ? 'bg-[#FF6D29]/10 border border-[#FF6D29]/20 text-white/80'
                                                : 'bg-[#38bdf8]/5 border border-[#38bdf8]/10 text-white/70'
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}

                            {isThinking && (
                                <div className="flex justify-start">
                                    <div className="px-3 py-2 rounded-sm bg-[#38bdf8]/5 border border-[#38bdf8]/10">
                                        <Loader2 className="size-3 text-[#38bdf8]/50 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="border-t border-white/5 p-3 flex-shrink-0">
                            <div className="flex items-end gap-2">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                    className="flex-1 px-3 py-2 rounded-sm border border-white/5 bg-white/[0.02]
                                        text-xs font-mono text-white/70 resize-none
                                        focus:outline-none focus:border-[#38bdf8]/20
                                        placeholder:text-white/20"
                                    placeholder={targetAgent
                                        ? `Ask about ${targetAgent.name}...`
                                        : 'Ask Agent Zero...'
                                    }
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isThinking}
                                    className="p-2 rounded-sm bg-[#38bdf8]/10 border border-[#38bdf8]/20
                                        text-[#38bdf8]/60 hover:text-[#38bdf8] hover:bg-[#38bdf8]/20
                                        transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Send className="size-3" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
