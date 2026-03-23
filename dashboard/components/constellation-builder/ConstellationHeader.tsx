"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Save, FolderOpen, Network, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConstellationStore } from "@/store/useConstellationStore";
import { toast } from "sonner";

export function ConstellationHeader() {
    const { activeId, activeName, nodes, edges, setActiveConstellation, setNodes, setEdges } = useConstellationStore();
    
    const [isSaveOpen, setIsSaveOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveName, setSaveName] = useState(activeName || "");
    const [saveDesc, setSaveDesc] = useState("");

    const [isLoadOpen, setIsLoadOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [savedList, setSavedList] = useState<any[]>([]);

    useEffect(() => {
        if (isSaveOpen && activeName) setSaveName(activeName);
    }, [isSaveOpen, activeName]);

    useEffect(() => {
        if (isLoadOpen) {
            setIsLoading(true);
            fetch('/api/constellation/list')
                .then(res => res.json())
                .then(data => {
                    if (data.constellations) setSavedList(data.constellations);
                })
                .finally(() => setIsLoading(false));
        }
    }, [isLoadOpen]);

    const handleSave = async () => {
        if (!saveName.trim()) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/constellation/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activeId,
                    name: saveName.trim(),
                    description: saveDesc.trim(),
                    nodes,
                    edges
                })
            });
            const data = await res.json();
            if (data.success) {
                setActiveConstellation(data.id, saveName.trim());
                toast.success("Constellation saved!");
                setIsSaveOpen(false);
            } else {
                toast.error(data.error || "Failed to save.");
            }
        } catch (e) {
            toast.error("An error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoad = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/constellation/get?id=${id}`);
            const data = await res.json();
            if (data.constellation) {
                const c = data.constellation;
                setNodes(c.nodes || []);
                setEdges(c.edges || []);
                setActiveConstellation(c.id, c.name);
                toast.success(`Loaded ${c.name}`);
                setIsLoadOpen(false);
            } else {
                toast.error("Failed to load.");
            }
        } catch (e) {
            toast.error("Error loading constellation.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
        
        try {
            const res = await fetch(`/api/constellation/delete?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setSavedList(prev => prev.filter(c => c.id !== id));
                toast.success(`Deleted ${name}`);
            } else {
                toast.error(data.error || "Failed to delete.");
            }
        } catch (error) {
            toast.error("Error deleting constellation.");
        }
    };

    return (
        <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsLoadOpen(true)}>
                <FolderOpen className="w-4 h-4" />
                Load Constellation
            </Button>
            <Button variant="default" size="sm" className="gap-2 bg-accent-base text-black hover:bg-accent-hover" onClick={() => setIsSaveOpen(true)}>
                <Save className="w-4 h-4" />
                Save Constellation
            </Button>

            <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save Constellation</DialogTitle>
                        <DialogDescription>Save your current knowledge spider net structure.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        <Input 
                            placeholder="Constellation Name" 
                            value={saveName} 
                            onChange={(e) => setSaveName(e.target.value)} 
                        />
                        <Textarea 
                            placeholder="Description (Optional)" 
                            value={saveDesc} 
                            onChange={(e) => setSaveDesc(e.target.value)} 
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveOpen(false)}>Cancel</Button>
                        <Button 
                            className="bg-accent-base text-black hover:bg-accent-hover" 
                            onClick={handleSave}
                            disabled={isSaving || !saveName.trim()}
                        >
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {activeId ? "Update" : "Save as New"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isLoadOpen} onOpenChange={setIsLoadOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Load Constellation</DialogTitle>
                        <DialogDescription>Select a previously saved knowledge spider net to jump back in.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 py-4 max-h-[400px] overflow-y-auto">
                        {isLoading && savedList.length === 0 ? (
                            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                        ) : savedList.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">No saved constellations found.</div>
                        ) : (
                            savedList.map((c) => (
                                <div key={c.id} className="group flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-accent-base/50 hover:bg-accent-base/5 cursor-pointer transition-colors" onClick={() => handleLoad(c.id)}>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground">{c.name}</span>
                                        <span className="text-xs text-muted-foreground">{c.nodesCount} nodes • Last updated: {new Date(c.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-red-500 mr-1"
                                            onClick={(e) => handleDelete(e, c.id, c.name)}
                                            title="Delete constellation"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-muted-foreground group-hover:text-accent-base">Load</Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
