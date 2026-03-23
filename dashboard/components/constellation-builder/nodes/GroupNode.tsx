import React, { useState } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import { useConstellationStore } from "@/store/useConstellationStore";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GroupNode({ id, data, selected }: any) {
    const spawnChat = useConstellationStore((s) => s.spawnChat);
    const updateNodeData = useConstellationStore((s) => s.updateNodeData);
    const { getNode } = useReactFlow();
    
    const [showColors, setShowColors] = useState(false);

    const handleSpawnChat = () => {
        const thisNode = getNode(id);
        const w = Number(thisNode?.style?.width || thisNode?.measured?.width || 300);
        const px = thisNode?.position?.x || 0;
        const py = thisNode?.position?.y || 0;

        // Spawn exactly 80px to the right of the group's right edge
        spawnChat(id, { x: px + w + 80, y: py });
    };

    return (
        <div 
            className={`relative w-full h-full rounded-xl border-2 border-dashed transition-colors group`}
            style={{
                borderColor: selected ? (data.color || 'var(--accent-base)') : 'var(--border)',
                backgroundColor: data.color ? `${data.color}11` : 'rgba(232, 90, 27, 0.05)'
            }}
        >
            <div className="absolute top-0 left-0 -translate-y-full pb-1 px-1 flex items-center justify-between w-full">
                <input 
                    className="text-xs font-semibold tracking-widest uppercase bg-transparent border-none outline-none focus:ring-1 focus:ring-accent-base focus:bg-background/90 px-1 rounded -ml-1 w-32 truncate pointer-events-auto"
                    style={{ color: data.color || 'var(--accent-base)' }}
                    value={data.title || ""}
                    onChange={(e) => updateNodeData(id, { title: e.target.value })}
                    placeholder="KNOWLEDGE GROUP"
                />
                
                {selected && (
                    <div className="flex items-center gap-2">
                        {/* Custom Color Selector */}
                        <div className="relative">
                            <button 
                                className="w-5 h-5 rounded-full border border-border shadow-sm pointer-events-auto hover:scale-110 transition-transform"
                                style={{ backgroundColor: data.color || 'var(--accent-base)' }}
                                onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); }}
                                title="Change Color"
                            />
                            {showColors && (
                                <div className="absolute bottom-8 right-0 bg-background border border-border rounded-lg shadow-xl p-2 flex gap-1 z-50 animate-in fade-in zoom-in-95 pointer-events-auto">
                                    {['#E85A1B', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#94a3b8'].map(c => (
                                        <button 
                                            key={c} 
                                            className="w-5 h-5 rounded-full hover:scale-110 transition-transform" 
                                            style={{ backgroundColor: c }} 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateNodeData(id, { color: c });
                                                setShowColors(false);
                                            }} 
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs gap-1 bg-background/80 hover:bg-accent-base hover:text-black border border-border pointer-events-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSpawnChat();
                            }}
                        >
                            <MessageSquarePlus className="w-3 h-3" />
                            Spawn Chat
                        </Button>
                    </div>
                )}
            </div>
            
            {/* Input handle for connecting groups */}
            <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-accent-base/50" />
            {/* Output handle for connecting groups */}
            <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-accent-base/50" />
        </div>
    );
}
