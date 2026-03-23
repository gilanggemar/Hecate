import React, { useState, useEffect, useRef } from "react";
import { Handle, Position } from "@xyflow/react";
import { MessageSquare, DownloadCloud, BrainCircuit, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatRouter } from "@/lib/useChatRouter";
import { useSocketStore } from "@/lib/useSocket";
import { useConstellationStore } from "@/store/useConstellationStore";
import { toast } from "sonner";

export function ChatNode({ id, data, selected }: any) {
    const { integratedAgents, getMessagesForAgent, dispatchMessage, isOpenClawConnected } = useChatRouter();
    const getAggregatedContext = useConstellationStore((s) => s.getAggregatedContext);
    const updateNodeData = useConstellationStore((s) => s.updateNodeData);
    const [selectedAgentId, setSelectedAgentId] = useState<string>(data?.selectedAgentId || '');
    const [inputValue, setInputValue] = useState("");
    const [isExtracting, setIsExtracting] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-select first agent
    useEffect(() => {
        if (!selectedAgentId && integratedAgents.length > 0) {
            setSelectedAgentId(integratedAgents[0].id);
            updateNodeData(id, { selectedAgentId: integratedAgents[0].id });
        }
    }, [integratedAgents, selectedAgentId, id, updateNodeData]);

    const sessionType = `nconstellation`;
    const sessionKey = `agent:${selectedAgentId}:${sessionType}`;
    
    // Fetch global live messages to optionally capture responses
    const liveMessages = selectedAgentId ? getMessagesForAgent(selectedAgentId, { sessionType }) : [];
    
    // Isolated UI state for this specific Chat Node instance
    const [localMessages, setLocalMessages] = useState<any[]>(data?.messages || []);
    const isWaitingForResponse = useRef(false);
    const activeMsgId = useRef<string | null>(null);

    // Sync messages back to the node's data state safely after render
    useEffect(() => {
        updateNodeData(id, { messages: localMessages });
    }, [localMessages, id, updateNodeData]);

    const updateLocalMessages = setLocalMessages;

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [localMessages.length, localMessages[localMessages.length - 1]?.content]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        const activeAgent = integratedAgents.find(a => a.id === selectedAgentId);
        if (!inputValue.trim() || !activeAgent || !selectedAgentId) return;

        const cleanMessage = inputValue.trim();
        setInputValue("");

        const { textContext, attachments } = getAggregatedContext(id);
        
        let finalMessage = cleanMessage;
        const isFirstMessage = localMessages.length === 0;

        if (textContext || attachments.length > 0) {
            if (isFirstMessage) {
                finalMessage = `[SYSTEM: CONSTELLATION KNOWLEDGE INJECTION]
You have been summoned into a new Constellation Node. The user has grouped a set of specific context files and linked them directly to you for a focused task.

<knowledge_payload>
Total Attached Files (Images/Binaries): ${attachments.length}
Text/Document Context:
${textContext || "No text documents attached."}
</knowledge_payload>

<directive>
As your VERY FIRST action in this new sub-workspace:
1. Carefully analyze all the incoming files, images, and text documents provided in the payload.
2. Output a well-formatted, brief list detailing what each file is and your initial understanding of its contents.
3. Proactively ask the user how they would like to utilize this specific constellation of files or what their goal is.
4. Important: Also address the user's initial message below if it contains a specific question or instruction.
</directive>

[USER INITIAL MESSAGE]
${cleanMessage}`;
            } else {
                finalMessage = `[LATEST CONSTELLATION CONTEXT]\n${textContext}\n\n[USER REQUEST]\n${cleanMessage}`;
            }
        }

        if (activeAgent.provider !== 'agent-zero') {
            const { addChatMessage: addToStore } = useSocketStore.getState();
            const finalAttachments = attachments.length > 0 ? attachments : undefined;
            const userMsgId = `user-${Date.now()}`;
            const localUserMsg = {
                id: userMsgId,
                role: 'user',
                content: cleanMessage,
                timestamp: new Date().toLocaleTimeString(),
                agentId: selectedAgentId,
                sessionKey: sessionKey,
                streaming: false,
                attachments: finalAttachments,
            };

            // Push to local UI instantly
            updateLocalMessages((prev: any[]) => [...prev, localUserMsg as any]);
            isWaitingForResponse.current = true;
            activeMsgId.current = null; // Reset tracker for next reply

            addToStore(localUserMsg as any);
            dispatchMessage(selectedAgentId, finalMessage, sessionKey, finalAttachments, true);
        } else {
            const finalAttachments = attachments.length > 0 ? attachments : undefined;
            const localUserMsg = {
                id: `user-${Date.now()}`,
                role: 'user',
                content: cleanMessage,
                timestamp: new Date().toLocaleTimeString()
            };
            updateLocalMessages((prev: any[]) => [...prev, localUserMsg as any]);
            isWaitingForResponse.current = true;
            activeMsgId.current = null;

            dispatchMessage(selectedAgentId, finalMessage, sessionKey, finalAttachments);
        }
    };

    const handleExtract = () => {
        if (!selectedAgentId) return;
        const activeAgent = integratedAgents.find(a => a.id === selectedAgentId);
        if (!activeAgent || (!activeAgent.isOnline && activeAgent.provider !== 'agent-zero')) {
            toast.error("Agent is offline or not selected.");
            return;
        }

        const { textContext, attachments } = getAggregatedContext(id);
        if (!textContext && attachments.length === 0) {
            toast.error("No knowledge found. Connect groups or attachments first.");
            return;
        }

        setIsExtracting(true);

        const prompt = `[SYSTEM EXTRACTION DIRECTIVE]
Please analyze all the provided Knowledge Spider Net context and our conversation so far. 
Summarize the core insights, facts, and conclusions into a single comprehensive paragraph. 
Do not include any conversational filler like "Here is the summary".
Respond ONLY with the raw knowledge text.`;

        let finalMessage = `[KNOWLEDGE CONTEXT]\n${textContext}\n\n${prompt}`;
        const finalAttachments = attachments.length > 0 ? attachments : undefined;

        if (activeAgent.provider !== 'agent-zero') {
            const { addChatMessage: addToStore } = useSocketStore.getState();
            const userMsgId = `user-${Date.now()}`;
            
            const localUserMsg = {
                id: userMsgId,
                role: 'user',
                content: "Extracting Insights...",
                timestamp: new Date().toLocaleTimeString(),
                agentId: selectedAgentId,
                sessionKey: sessionKey,
                streaming: false,
            };

            updateLocalMessages((prev: any[]) => [...prev, localUserMsg as any]);
            isWaitingForResponse.current = true;
            activeMsgId.current = null;

            addToStore(localUserMsg as any);
            dispatchMessage(selectedAgentId, finalMessage, sessionKey, finalAttachments, true);
        } else {
            const localUserMsg = {
                id: `user-${Date.now()}`,
                role: 'user',
                content: "Extracting Insights...",
                timestamp: new Date().toLocaleTimeString()
            };
            updateLocalMessages((prev: any[]) => [...prev, localUserMsg as any]);
            isWaitingForResponse.current = true;
            activeMsgId.current = null;

            dispatchMessage(selectedAgentId, finalMessage, sessionKey, finalAttachments);
        }
    };

    // Effect to catch the extraction result or general streaming responses
    useEffect(() => {
        if (liveMessages.length === 0) return;
        if (!isWaitingForResponse.current && !activeMsgId.current) return;
        
        let msgToSync = null;

        // If we are waiting for a new reply to start, grab the very latest one
        if (isWaitingForResponse.current && !activeMsgId.current) {
            const lastMsg = liveMessages[liveMessages.length - 1];
            if (lastMsg.role === 'assistant') {
                activeMsgId.current = lastMsg.id;
                msgToSync = lastMsg;
            }
        } 
        
        // Find the active message anywhere in liveMessages to get its absolute latest state
        if (activeMsgId.current) {
            msgToSync = liveMessages.find((m) => m.id === activeMsgId.current) || msgToSync;
        }

        if (msgToSync) {
            updateLocalMessages((prev: any[]) => {
                const existingIdx = prev.findIndex((m: any) => m.id === msgToSync.id);
                if (existingIdx >= 0) {
                    const current = prev[existingIdx];
                    if (current.content === msgToSync.content && 
                        current.streaming === msgToSync.streaming &&
                        JSON.stringify(current.tool_calls) === JSON.stringify(msgToSync.tool_calls)) {
                        return prev;
                    }

                    const next = [...prev];
                    next[existingIdx] = msgToSync;
                    return next;
                }
                return [...prev, msgToSync];
            });
            
            // Un-flag waiting lock if the generation has finished
            if (!msgToSync.streaming) {
                isWaitingForResponse.current = false;
                
                // If it was an extraction task
                if (isExtracting && msgToSync.content) {
                    setIsExtracting(false);
                    fetch('/api/constellation/save-fragment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agentId: selectedAgentId,
                            content: msgToSync.content,
                            source: 'constellation_extract',
                            tags: ['spider_net', 'extracted']
                        })
                    })
                    .then(res => res.json())
                    .then(data => data.success ? toast.success("Knowledge stored successfully!") : toast.error("Failed to store knowledge."))
                    .catch(() => toast.error("Error saving knowledge."));
                }
            }
        }
    }, [liveMessages, isExtracting, selectedAgentId]);

    return (
        <div className={`bg-background/90 backdrop-blur-xl border-2 shadow-2xl rounded-xl w-[350px] h-[450px] flex flex-col overflow-hidden transition-colors ${selected ? 'border-accent-base ring-2 ring-accent-base/20' : 'border-border ring-1 ring-white/5'}`}>
            <div className="p-2 border-b border-white/10 flex items-center justify-between bg-black/40 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MessageSquare className="w-4 h-4 text-accent-base shrink-0" />
                    <select
                        value={selectedAgentId}
                        onChange={(e) => {
                            setSelectedAgentId(e.target.value);
                            updateNodeData(id, { selectedAgentId: e.target.value });
                        }}
                        className="bg-transparent text-sm font-semibold tracking-wide border-none outline-none focus:ring-0 cursor-pointer flex-1 min-w-0 appearance-none text-foreground py-1"
                        style={{ WebkitAppearance: 'none' }}
                    >
                        <option value="" disabled>Select Agent...</option>
                        {integratedAgents.map(a => (
                            <option key={a.id} value={a.id} className="bg-background text-foreground">
                                {a.name} {a.isOnline ? '🟢' : '⚪'}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-1 shrink-0">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground hover:text-accent-base" 
                        title="Extract Knowledge"
                        onClick={handleExtract}
                        disabled={isExtracting}
                    >
                        {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            <div 
                ref={scrollRef}
                className="p-4 flex-1 h-[250px] overflow-y-auto flex flex-col gap-3 scroll-smooth nodrag cursor-text"
                onWheel={(e) => e.stopPropagation()} // Let user scroll inside without zooming canvas
            >
                {localMessages.length === 0 ? (
                    <div className="m-auto text-center text-muted-foreground flex flex-col items-center gap-2">
                        <BrainCircuit className="w-8 h-8 opacity-50" />
                        <span className="text-xs">Ready to explore this knowledge group.</span>
                        <span className="text-[10px] opacity-50">Connect Group Nodes here to fuse knowledge.</span>
                    </div>
                ) : (
                    localMessages.map((m, i) => (
                        <div key={i} className={`text-sm flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`inline-block px-3 py-2 rounded-xl max-w-[85%] whitespace-pre-wrap word-break ${m.role === 'user' ? 'bg-accent-base/20 text-accent-base rounded-tr-sm' : 'bg-white/5 text-foreground rounded-tl-sm border border-white/5'}`}>
                                {m.content || (m.streaming && <Loader2 className="w-3 h-3 animate-spin opacity-50" />)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-2 bg-black/40 border-t border-white/10 nodrag">
                <form 
                    onSubmit={handleSend}
                    className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 focus-within:border-accent-base/50 focus-within:ring-1 focus-within:ring-accent-base/50 transition-all"
                >
                    <input 
                        type="text" 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask about this constellation..." 
                        className="w-full bg-transparent border-none outline-none focus:ring-0 text-sm placeholder:text-muted-foreground/50 py-1"
                    />
                    <Button 
                        type="submit" 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-accent-base hover:bg-transparent"
                        disabled={!inputValue.trim() || !selectedAgentId}
                    >
                        <Send className="w-3 h-3" />
                    </Button>
                </form>
            </div>

            {/* Input handle from elements inside or outside */}
            <Handle type="target" position={Position.Left} className="w-4 h-4 !bg-accent-base/80 border-2 border-background" />
            <Handle type="source" position={Position.Right} className="w-4 h-4 !bg-accent-base/80 border-2 border-background" />
        </div>
    );
}
