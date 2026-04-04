"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Code2, Key, Plus, Trash2, Copy, Check, Eye, EyeOff,
    ChevronRight, Shield, Braces,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { API_ENDPOINTS } from "@/lib/api/types";
import type { ApiEndpoint } from "@/lib/api/types";

type Tab = "endpoints" | "keys";

const METHOD_COLORS: Record<string, string> = {
    GET: "text-emerald-400 bg-emerald-400/10",
    POST: "text-blue-400 bg-blue-400/10",
    PUT: "text-amber-400 bg-amber-400/10",
    DELETE: "text-red-400 bg-red-400/10",
};

export default function ApiReferencePage() {
    const [tab, setTab] = useState<Tab>("endpoints");
    const [keys, setKeys] = useState<any[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

    const fetchKeys = useCallback(async () => {
        const res = await fetch("/api/api-keys");
        if (res.ok) setKeys(await res.json());
    }, []);

    useEffect(() => { fetchKeys(); }, [fetchKeys]);

    const handleDeleteKey = useCallback(async (id: string) => {
        await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
        fetchKeys();
    }, [fetchKeys]);

    return (
        <div className="flex flex-col h-full gap-5">
            <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">API Reference</h1>
                    <Badge variant="secondary" className="text-[9px] h-4 rounded px-1.5 font-mono">v1</Badge>
                </div>
                {tab === "keys" && (
                    <Button size="sm" className="rounded-full h-8 px-4 text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                        onClick={() => setCreateOpen(true)}>
                        <Plus className="w-3 h-3" /> New Key
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-1 bg-accent/30 rounded-md p-1 w-fit">
                <button onClick={() => setTab("endpoints")} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "endpoints" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    <Braces className="w-3.5 h-3.5 inline mr-1.5" />Endpoints
                </button>
                <button onClick={() => setTab("keys")} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "keys" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    <Key className="w-3.5 h-3.5 inline mr-1.5" />API Keys
                </button>
            </div>

            {/* Base URL */}
            <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground/60">Base URL:</span>
                <code className="px-2 py-0.5 rounded bg-accent/50 text-foreground font-mono text-[10px]">
                    http://localhost:3000
                </code>
            </div>

            <ScrollArea className="flex-1">
                {tab === "endpoints" ? (
                    <div className="space-y-1.5 pb-6 max-w-3xl">
                        {API_ENDPOINTS.map((ep, i) => {
                            const key = `${ep.method}-${ep.path}`;
                            const expanded = expandedEndpoint === key;
                            return (
                                <motion.div key={key} layout>
                                    <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0 cursor-pointer hover:bg-accent/20 transition-colors"
                                        onClick={() => setExpandedEndpoint(expanded ? null : key)}>
                                        <CardContent className="p-3">
                                            <div className="flex items-center gap-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${METHOD_COLORS[ep.method] || ""}`}>
                                                    {ep.method}
                                                </span>
                                                <code className="text-xs font-mono text-foreground/80 flex-1">{ep.path}</code>
                                                {ep.auth && <Shield className="w-3 h-3 text-muted-foreground/30" />}
                                                <ChevronRight className={`w-3 h-3 text-muted-foreground/30 transition-transform ${expanded ? "rotate-90" : ""}`} />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1 ml-14">{ep.description}</p>

                                            <AnimatePresence>
                                                {expanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-3 ml-14 space-y-2 border-t border-border pt-3">
                                                            {ep.auth && (
                                                                <div className="text-[10px] text-muted-foreground/60">
                                                                    <span className="font-medium text-foreground/60">Auth:</span> Bearer token (API key)
                                                                </div>
                                                            )}
                                                            {ep.params && ep.params.length > 0 && (
                                                                <div>
                                                                    <span className="text-[10px] font-medium text-foreground/60">Parameters:</span>
                                                                    <div className="mt-1 space-y-1">
                                                                        {ep.params.map((p) => (
                                                                            <div key={p.name} className="flex items-center gap-2 text-[10px]">
                                                                                <code className="text-[9px] font-mono px-1 py-0.5 rounded bg-accent/50">{p.name}</code>
                                                                                <span className="text-muted-foreground/40">{p.type}</span>
                                                                                {p.required && <Badge variant="secondary" className="text-[8px] h-3 rounded px-1 font-normal text-amber-400">required</Badge>}
                                                                                <span className="text-muted-foreground/50">{p.description}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="text-[10px] font-medium text-foreground/60">Response:</span>
                                                                <code className="block text-[9px] font-mono mt-1 px-2 py-1.5 rounded bg-accent/30 text-muted-foreground">{ep.response}</code>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-2 pb-6 max-w-2xl">
                        {keys.length === 0 ? (
                            <Card className="rounded-md border-dashed border-border bg-card/50 shadow-none">
                                <CardContent className="p-8 text-center">
                                    <Key className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                                    <p className="text-sm text-muted-foreground">No API keys.</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">Create a key to access the REST API.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {keys.map((k: any) => (
                                    <motion.div key={k.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                                        <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/50 text-amber-400 shrink-0">
                                                        <Key className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-foreground">{k.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <code className="text-[10px] font-mono text-muted-foreground">{k.prefix}••••••••</code>
                                                            <Badge variant="secondary" className="text-[9px] h-3.5 rounded px-1 font-normal">
                                                                {(k.permissions || []).join(', ')}
                                                            </Badge>
                                                        </div>
                                                        {k.lastUsedAt && (
                                                            <span className="text-[9px] text-muted-foreground/40 mt-0.5 block">
                                                                Last used: {new Date(k.lastUsedAt).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                                                        onClick={() => handleDeleteKey(k.id)}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                )}
            </ScrollArea>

            <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchKeys} />
        </div>
    );
}

function CreateKeyDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
    const [name, setName] = useState("");
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/api-keys", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), permissions: ["read", "write"] }),
            });
            if (res.ok) {
                const data = await res.json();
                setNewKey(data.key);
                onCreated();
            }
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };

    const handleCopy = () => {
        if (newKey) { navigator.clipboard.writeText(newKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    const handleClose = (o: boolean) => {
        if (!o) { setName(""); setNewKey(null); setCopied(false); }
        onOpenChange(o);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md rounded-md">
                <DialogHeader><DialogTitle className="text-base">{newKey ? "API Key Created" : "New API Key"}</DialogTitle></DialogHeader>
                {newKey ? (
                    <div className="space-y-3 py-2">
                        <p className="text-[11px] text-amber-400">⚠ Copy this key now. It won't be shown again.</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-[11px] font-mono px-3 py-2 rounded-md bg-accent/50 text-foreground break-all">{newKey}</code>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={handleCopy}>
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">Name</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My API Key"
                                className="h-8 text-[13px] rounded-md border-border bg-background" />
                        </div>
                    </div>
                )}
                <DialogFooter>
                    {newKey ? (
                        <Button size="sm" className="rounded-full h-8 px-5 text-xs bg-foreground text-background hover:bg-foreground/90" onClick={() => handleClose(false)}>Done</Button>
                    ) : (
                        <>
                            <DialogClose asChild><Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs">Cancel</Button></DialogClose>
                            <Button size="sm" className="rounded-full h-8 px-5 text-xs bg-foreground text-background hover:bg-foreground/90" onClick={handleCreate} disabled={saving || !name.trim()}>Create</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
