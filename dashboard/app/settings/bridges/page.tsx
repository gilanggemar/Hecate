"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Link, Box, MessageSquare, Github, Send, Trash2, Plus, Users, Shield, RefreshCw, Loader2, CheckCircle2, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useBridgesStore } from "@/store/useBridgesStore";
import { PLATFORM_METADATA } from "@/lib/bridges/types";
import type { BridgeConfig, PlatformType, BridgeStatus } from "@/lib/bridges/types";

const STATUS_ICONS: Record<BridgeStatus, { icon: any; color: string }> = {
    connected: { icon: CheckCircle2, color: "text-emerald-400" },
    disconnected: { icon: XCircle, color: "text-muted-foreground/50" },
    error: { icon: XCircle, color: "text-red-400" },
    connecting: { icon: Loader2, color: "text-blue-400" },
};

const PLATFORM_ICONS: Record<PlatformType, any> = {
    discord: MessageSquare,
    slack: Box,
    github: Github,
    telegram: Send,
};

export default function PlatformBridgesPage() {
    const { bridges, fetchBridges } = useBridgesStore();
    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => { fetchBridges(); }, [fetchBridges]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm("Remove this platform bridge?")) return;
        await fetch(`/api/bridges/${id}`, { method: "DELETE" });
        fetchBridges();
    }, [fetchBridges]);

    const handleToggleAgent = useCallback(async (bridgeId: string, agentId: string) => {
        await fetch(`/api/bridges/${bridgeId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toggleAgent: agentId }),
        });
        fetchBridges();
    }, [fetchBridges]);

    const handleTest = useCallback(async (bridgeId: string) => {
        // Simulate connection test
        await fetch(`/api/bridges/${bridgeId}`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "connecting" }),
        });
        fetchBridges();
        setTimeout(async () => {
            await fetch(`/api/bridges/${bridgeId}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "connected", lastSyncedAt: Date.now() }),
            });
            fetchBridges();
        }, 1500);
    }, [fetchBridges]);

    return (
        <div className="flex flex-col h-full gap-5">
            <div className="flex items-center justify-between pb-3">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Platform Bridges</h1>
                <Button size="sm" className="rounded-full h-8 px-4 text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                    onClick={() => setCreateOpen(true)}>
                    <Plus className="w-3 h-3" /> New Bridge
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="space-y-3 pb-6 max-w-3xl">
                    {bridges.length === 0 ? (
                        <Card className="rounded-md border-dashed border-border bg-card/50 shadow-none">
                            <CardContent className="p-8 text-center">
                                <Link className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                                <p className="text-sm text-muted-foreground">No platform bridges configured.</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Connect your agents to Discord, Slack, GitHub, or Telegram.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {bridges.map((bridge) => {
                                const statusCfg = STATUS_ICONS[bridge.status];
                                const StatusIcon = statusCfg.icon;
                                const meta = PLATFORM_METADATA[bridge.platform];
                                const PlatformIcon = PLATFORM_ICONS[bridge.platform];

                                return (
                                    <motion.div key={bridge.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                                        <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
                                            <CardContent className="p-4">
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-md flex items-center justify-center bg-accent/30 ${meta.color} shrink-0`}>
                                                        <PlatformIcon className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-sm font-medium text-foreground">{bridge.name}</p>
                                                            <Badge variant="secondary" className="text-[9px] h-3.5 rounded px-1.5 font-normal capitalize">
                                                                {bridge.platform}
                                                            </Badge>
                                                            <Badge variant="secondary" className={`text-[9px] h-3.5 rounded px-1.5 font-normal ${statusCfg.color} flex items-center gap-1`}>
                                                                <StatusIcon className={`w-2.5 h-2.5 ${bridge.status === 'connecting' ? 'animate-spin' : ''}`} />
                                                                {bridge.status}
                                                            </Badge>
                                                        </div>

                                                        <p className="text-[11px] text-muted-foreground mb-3">{meta.description}</p>

                                                        <div className="flex items-center gap-1.5">
                                                            <Users className="w-3 h-3 text-muted-foreground/40" />
                                                            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mr-1">Active Agents:</span>
                                                            {["daisy", "ivy", "celia", "thalia"].map((agent) => (
                                                                <button key={agent} onClick={() => handleToggleAgent(bridge.id, agent)}
                                                                    className={`text-[10px] px-2 py-0.5 rounded capitalize transition-colors ${bridge.assignedAgents.includes(agent) ? "bg-foreground/10 text-foreground font-medium" : "bg-accent/30 text-muted-foreground/40 hover:text-muted-foreground"
                                                                        }`}>
                                                                    {agent}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Button variant="ghost" size="sm" className="h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-blue-400 gap-1.5"
                                                            onClick={() => handleTest(bridge.id)}>
                                                            <RefreshCw className="w-3 h-3" /> Connect
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                                                            onClick={() => handleDelete(bridge.id)}>
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>
            </ScrollArea>

            <CreateBridgeDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchBridges} />
        </div>
    );
}

function CreateBridgeDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
    const [platform, setPlatform] = useState<PlatformType>("discord");
    const [name, setName] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [webhookUrl, setWebhookUrl] = useState("");
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await fetch("/api/bridges", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform, name: name.trim(), apiKey: apiKey.trim(), webhookUrl: webhookUrl.trim() }),
            });
            setName(""); setApiKey(""); setWebhookUrl(""); setPlatform("discord");
            onCreated(); onOpenChange(false);
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-md">
                <DialogHeader><DialogTitle className="text-base">Configure Platform Bridge</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Platform</label>
                        <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformType)}>
                            <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-md">
                                {Object.entries(PLATFORM_METADATA).map(([key, meta]) => (
                                    <SelectItem key={key} value={key} className="text-xs rounded-lg">{meta.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Connection Name</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering Server" className="h-8 text-[13px] rounded-md border-border bg-background" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> API Key / Token</label>
                        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="Bot token or API key" className="h-8 text-[13px] rounded-md border-border bg-background font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Webhook URL (Optional)</label>
                        <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://..." className="h-8 text-[13px] rounded-md border-border bg-background font-mono" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs">Cancel</Button></DialogClose>
                    <Button size="sm" className="rounded-full h-8 px-5 text-xs bg-foreground text-background hover:bg-foreground/90" onClick={handleCreate} disabled={saving || !name.trim()}>Connect</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
