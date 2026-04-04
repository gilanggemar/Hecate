"use client";

import { useEffect, useState, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Loader2, GripVertical, Plus } from "lucide-react";
import { useSummitTaskStore } from "@/store/useSummitTaskStore";
import { useSocketStore, useSocket } from "@/lib/useSocket";
import { useTaskStore } from "@/lib/useTaskStore";
import { getAgentProfile } from "@/lib/agentRoster";

// Standard UI confirmation modal
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SummitTaskModal() {
    const { isOpen, summary, participants, agentTasks, closeModal, setAgentTasks } = useSummitTaskStore();
    const { chatMessages } = useSocketStore();
    const { sendChatMessage } = useSocket();
    const { addTask } = useTaskStore();

    const [loadingAgents, setLoadingAgents] = useState<Record<string, boolean>>({});
    const [editableTasks, setEditableTasks] = useState<Record<string, string[]>>({});
    const initializedRef = useRef(false);
    
    // For Cancel confirmation
    const [showCancelAlert, setShowCancelAlert] = useState(false);

    // Track the time the modal was opened to only parse new messages
    const [mountTime, setMountTime] = useState(0);

    useEffect(() => {
        if (isOpen && summary && participants.length > 0 && !initializedRef.current) {
            initializedRef.current = true;
            setMountTime(Date.now());
            setEditableTasks({});
            
            const initialLoadingState: Record<string, boolean> = {};
            
            participants.forEach(agentId => {
                initialLoadingState[agentId] = true;
                const agentName = getAgentProfile(agentId)?.name || agentId;
                const prompt = `You are ${agentName}. Based on the following summit deliberation summary, please extract the execution tasks that are assigned to YOU and ONLY YOU. Output ONLY a JSON array of task strings inside a \`\`\`json\`\`\` block. If there are no tasks for you, output an empty array []. Do not output tasks assigned to other agents. Do not output conversational filler. Example: \`\`\`json\n["Task 1", "Task 2"]\n\`\`\`\n\nSummary:\n${summary}`;
                const sessionKey = `agent:${agentId}:summit`;
                sendChatMessage(agentId, prompt, sessionKey);
            });
            
            setLoadingAgents(initialLoadingState);
        } else if (!isOpen) {
            initializedRef.current = false;
        }
    }, [isOpen, summary, participants, sendChatMessage]);

    // Parse incoming messages
    useEffect(() => {
        if (!isOpen) return;

        participants.forEach(agentId => {
            if (!loadingAgents[agentId]) return;

            const sessionKey = `agent:${agentId}:summit`;
            // Find the latest message from the assistant after mount time
            const agentMsgs = chatMessages.filter(m => 
                m.sessionKey === sessionKey && 
                m.agentId === agentId && 
                m.role === 'assistant'
            );
            
            if (agentMsgs.length === 0) return;
            const latestMsg = agentMsgs[agentMsgs.length - 1];

            // If it's done streaming, parse it
            if (!latestMsg.streaming) {
                const match = latestMsg.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                let tasks: string[] = [];
                
                try {
                    if (match && match[1]) {
                        tasks = JSON.parse(match[1]);
                    } else if (latestMsg.content.trim().startsWith('[')) {
                        tasks = JSON.parse(latestMsg.content.trim());
                    } else {
                        // Fallback: split by lines if it looks like a list
                        tasks = latestMsg.content
                            .split('\n')
                            .map(l => l.replace(/^[-*0-9.]+\s*/, '').replace(/```/g, '').trim())
                            .filter(l => l.length > 0 && !l.toLowerCase().includes("json") && l !== '[' && l !== ']');
                    }
                } catch (e) {
                    tasks = ["Failed to parse tasks from agent."];
                }

                if (!Array.isArray(tasks)) tasks = ["Invalid task format returned."];
                
                // Set the editable tasks and mark as not loading
                setEditableTasks(prev => ({ ...prev, [agentId]: tasks }));
                setLoadingAgents(prev => ({ ...prev, [agentId]: false }));
            }
        });
    }, [chatMessages, isOpen, participants, loadingAgents]);

    const handleTaskChange = (agentId: string, index: number, val: string) => {
        setEditableTasks(prev => {
            const arr = [...(prev[agentId] || [])];
            arr[index] = val;
            return { ...prev, [agentId]: arr };
        });
    };

    const handleRemoveTask = (agentId: string, index: number) => {
        setEditableTasks(prev => {
            const arr = [...(prev[agentId] || [])];
            arr.splice(index, 1);
            return { ...prev, [agentId]: arr };
        });
    };

    const handleAddTask = (agentId: string) => {
        setEditableTasks(prev => {
            const arr = [...(prev[agentId] || [])];
            arr.push("New Task");
            return { ...prev, [agentId]: arr };
        });
    };

    const handleProceed = () => {
        // Save tasks directly
        participants.forEach(agentId => {
            const tasks = editableTasks[agentId] || [];
            tasks.forEach((taskStr, i) => {
                if (!taskStr.trim()) return;
                addTask({
                    id: `task-${Date.now().toString().slice(-4)}-${agentId}-${i}`,
                    title: taskStr.trim(),
                    agentId: agentId,
                    status: "PENDING",
                    priority: "HIGH",
                    updatedAt: Date.now(),
                    timestamp: new Date().toLocaleTimeString()
                });
            });
        });
        
        closeModal();
    };

    const handleCancelClick = () => {
        setShowCancelAlert(true);
    };

    const confirmCancel = () => {
        setShowCancelAlert(false);
        closeModal();
    };

    // Calculate overall loading state
    const isAnyLoading = Object.values(loadingAgents).some(v => v);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(val) => {
                if (!val) handleCancelClick(); // Intercept clicking outside / pressing ESC
            }}>
                <DialogContent className="sm:max-w-5xl w-[95vw] sm:w-[90vw] md:w-[80vw] h-[85vh] p-0 flex flex-col overflow-hidden">
                    <div className="p-6 pb-2 shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Summit Tasks Execution Plan</DialogTitle>
                            <DialogDescription>
                                Agents are reviewing the summit deliberation and creating tasks for themselves. You can edit, add, or delete tasks before proceeding.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 min-h-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 pt-2">
                            {participants.map(agentId => (
                                <div key={agentId} className="space-y-3 bg-secondary/10 p-4 rounded-md border border-border/50 h-fit">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-sm">{getAgentProfile(agentId)?.name || agentId}</h3>
                                            {loadingAgents[agentId] && (
                                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                            )}
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-xs" 
                                            onClick={() => handleAddTask(agentId)}
                                            disabled={loadingAgents[agentId]}
                                        >
                                            <Plus className="w-3 h-3 mr-1" /> Add Task
                                        </Button>
                                    </div>

                                    {loadingAgents[agentId] ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="h-9 bg-primary/5 rounded-md animate-pulse" />
                                            <div className="h-9 bg-primary/5 rounded-md animate-pulse opacity-50" />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {(editableTasks[agentId] || []).length === 0 ? (
                                                <p className="text-xs text-muted-foreground italic">No tasks assigned.</p>
                                            ) : (
                                                (editableTasks[agentId] || []).map((taskText, idx) => (
                                                    <div key={idx} className="flex flex-row items-center gap-2 group">
                                                        <GripVertical className="w-4 h-4 text-muted-foreground/40 cursor-grab shrink-0" />
                                                        <Input 
                                                            value={taskText}
                                                            onChange={(e) => handleTaskChange(agentId, idx, e.target.value)}
                                                            className="flex-1 h-9 text-sm"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                            onClick={() => handleRemoveTask(agentId, idx)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 pt-4 border-t bg-background/50 backdrop-blur shrink-0 mt-auto">
                        <DialogFooter>
                            <Button variant="outline" onClick={handleCancelClick}>Cancel</Button>
                            <Button 
                                onClick={handleProceed} 
                                disabled={isAnyLoading}
                                className="bg-orange-500 hover:bg-orange-600 text-white min-w-24"
                            >
                                {isAnyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Proceed"}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
                        <AlertDialogDescription>
                            If you cancel now, all the generated execution tasks will be lost and they will not be added to the agents' task lists.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={confirmCancel}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            Discard Tasks
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
