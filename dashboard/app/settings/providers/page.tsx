"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Trash2, TestTube, CheckCircle, XCircle, Loader2,
    ChevronDown, Key, Globe, Zap, Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useProviderStore, type ProviderRecord } from "@/store/useProviderStore";
import type { ProviderStatus, ProviderType } from "@/lib/providers/types";

// ─── Provider type metadata (display info only) ─────────────────────────────

const PROVIDER_TYPES: { value: ProviderType; label: string; description: string; requiresKey: boolean }[] = [
    { value: "openclaw", label: "OpenClaw", description: "Native gateway", requiresKey: false },
    { value: "anthropic", label: "Anthropic", description: "Claude models", requiresKey: true },
    { value: "openai", label: "OpenAI", description: "GPT & o-series", requiresKey: true },
    { value: "google", label: "Google Gemini", description: "Gemini family", requiresKey: true },
    { value: "deepseek", label: "DeepSeek", description: "Reasoning models", requiresKey: true },
    { value: "groq", label: "Groq", description: "Ultra-fast inference", requiresKey: true },
    { value: "mistral", label: "Mistral", description: "Efficient models", requiresKey: true },
    { value: "xai", label: "xAI", description: "Grok models", requiresKey: true },
    { value: "ollama", label: "Ollama", description: "Local models", requiresKey: false },
    { value: "together", label: "Together AI", description: "Open-source at scale", requiresKey: true },
];

const statusColors: Record<string, string> = {
    connected: "bg-emerald-500",
    degraded: "bg-amber-500",
    disconnected: "bg-red-500",
    unknown: "bg-zinc-500",
    testing: "bg-blue-500 animate-pulse",
};

export default function ProvidersPage() {
    const { providers, statuses, setProviders, addProvider, removeProvider, setStatus, isLoading, setLoading } = useProviderStore();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);

    // ─── Fetch providers on mount ────────────────────────────────────────────
    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const res = await fetch("/api/providers");
                if (res.ok) {
                    const data = await res.json();
                    setProviders(data);
                }
            } catch (e) {
                console.error("Failed to load providers:", e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [setProviders, setLoading]);

    // ─── Test connection ─────────────────────────────────────────────────────
    const handleTest = useCallback(async (id: string) => {
        setTestingId(id);
        setStatus(id, "unknown");
        try {
            const res = await fetch(`/api/providers/${id}/test`, { method: "POST" });
            const data = await res.json();
            setStatus(id, data.success ? "connected" : "disconnected");
        } catch {
            setStatus(id, "disconnected");
        } finally {
            setTestingId(null);
        }
    }, [setStatus]);

    // ─── Delete provider ─────────────────────────────────────────────────────
    const handleDelete = useCallback(async (id: string) => {
        if (!confirm("Remove this provider?")) return;
        try {
            await fetch(`/api/providers/${id}`, { method: "DELETE" });
            removeProvider(id);
        } catch (e) {
            console.error("Failed to delete provider:", e);
        }
    }, [removeProvider]);

    const providerList = Object.values(providers);

    return (
        <div className="flex flex-col h-full gap-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Providers</h1>
                <AddProviderDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    onAdded={(p) => { addProvider(p); setDialogOpen(false); }}
                />
            </div>

            <ScrollArea className="flex-1">
                <div className="max-w-2xl space-y-4 pb-6">
                    {/* Section label */}
                    <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Server className="w-3.5 h-3.5" /> Configured Providers
                    </h2>

                    {providerList.length === 0 && !isLoading && (
                        <Card className="rounded-md border-dashed border-border bg-card/50 shadow-none">
                            <CardContent className="p-8 text-center">
                                <Zap className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                                <p className="text-sm text-muted-foreground">No providers configured yet.</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Add your first LLM provider to get started.</p>
                            </CardContent>
                        </Card>
                    )}

                    <AnimatePresence mode="popLayout">
                        {providerList.map((provider) => {
                            const isTesting = testingId === provider.id;
                            const connStatus = statuses[provider.id] || "unknown";
                            const typeMeta = PROVIDER_TYPES.find((t) => t.value === provider.type);

                            return (
                                <motion.div
                                    key={provider.id}
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {/* Status dot */}
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${isTesting ? statusColors.testing : statusColors[connStatus]}`} />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium text-foreground">{provider.name}</p>
                                                            <Badge variant="secondary" className="text-[10px] h-5 rounded-lg px-2 font-normal">
                                                                {typeMeta?.label || provider.type}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                                            {provider.maskedKey || "No API key"} · {provider.baseUrl || typeMeta?.description || "Default endpoint"}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-2.5 text-[11px] rounded-lg text-muted-foreground hover:text-foreground gap-1.5"
                                                        onClick={() => handleTest(provider.id)}
                                                        disabled={isTesting}
                                                    >
                                                        {isTesting ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : connStatus === "connected" ? (
                                                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                                                        ) : connStatus === "disconnected" ? (
                                                            <XCircle className="w-3 h-3 text-red-500" />
                                                        ) : (
                                                            <TestTube className="w-3 h-3" />
                                                        )}
                                                        Test
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                                                        onClick={() => handleDelete(provider.id)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </ScrollArea>
        </div>
    );
}

// ─── Add Provider Dialog ─────────────────────────────────────────────────────

function AddProviderDialog({
    open,
    onOpenChange,
    onAdded,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdded: (provider: ProviderRecord) => void;
}) {
    const [name, setName] = useState("");
    const [type, setType] = useState<ProviderType>("openai");
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const selectedMeta = PROVIDER_TYPES.find((t) => t.value === type);

    const handleSave = async () => {
        if (!name.trim()) { setError("Name is required"); return; }
        setError("");
        setSaving(true);
        try {
            const res = await fetch("/api/providers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    type,
                    apiKey: apiKey.trim() || undefined,
                    baseUrl: baseUrl.trim() || undefined,
                }),
            });
            if (!res.ok) throw new Error("Failed to save");
            const data = await res.json();
            onAdded(data);
            // Reset
            setName(""); setApiKey(""); setBaseUrl(""); setType("openai");
        } catch {
            setError("Failed to save provider");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button
                    size="sm"
                    className="rounded-full h-9 px-5 text-xs bg-foreground text-background hover:bg-foreground/90 gap-2"
                >
                    <Plus className="w-3 h-3" /> Add Provider
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-md">
                <DialogHeader>
                    <DialogTitle className="text-base">Add Provider</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Provider Type */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Provider Type</label>
                        <Select value={type} onValueChange={(v) => setType(v as ProviderType)}>
                            <SelectTrigger className="h-9 text-[13px] rounded-md border-border bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-md">
                                {PROVIDER_TYPES.map((p) => (
                                    <SelectItem key={p.value} value={p.value} className="text-xs rounded-md">
                                        <span className="font-medium">{p.label}</span>
                                        <span className="text-muted-foreground ml-1.5">— {p.description}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Display Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={`My ${selectedMeta?.label || "Provider"}`}
                            className="h-9 text-[13px] rounded-md border-border bg-background"
                        />
                    </div>

                    {/* API Key */}
                    {selectedMeta?.requiresKey !== false && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                <Key className="w-3 h-3" /> API Key
                            </label>
                            <Input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-•••"
                                className="h-9 text-[13px] rounded-md border-border bg-background font-mono"
                            />
                        </div>
                    )}

                    {/* Base URL */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Globe className="w-3 h-3" /> Base URL
                            <span className="text-muted-foreground/50">(optional)</span>
                        </label>
                        <Input
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder={selectedMeta ? `Default: varies by provider` : "https://api.example.com"}
                            className="h-9 text-[13px] rounded-md border-border bg-background"
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-400">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        size="sm"
                        className="rounded-full h-8 px-5 text-xs bg-foreground text-background hover:bg-foreground/90"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : null}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
