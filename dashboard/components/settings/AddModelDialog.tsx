"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Loader2, Key, Globe, Cpu, CheckCircle, XCircle,
    Zap, Hash, Type, TestTube, Save, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCustomModelStore } from "@/stores/useCustomModelStore";

// ─── Known provider types ────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
    { value: "openai", label: "OpenAI", defaultUrl: "https://api.openai.com", requiresKey: true },
    { value: "anthropic", label: "Anthropic", defaultUrl: "https://api.anthropic.com", requiresKey: true },
    { value: "google", label: "Google Gemini", defaultUrl: "https://generativelanguage.googleapis.com", requiresKey: true },
    { value: "deepseek", label: "DeepSeek", defaultUrl: "https://api.deepseek.com", requiresKey: true },
    { value: "groq", label: "Groq", defaultUrl: "https://api.groq.com/openai", requiresKey: true },
    { value: "mistral", label: "Mistral", defaultUrl: "https://api.mistral.ai", requiresKey: true },
    { value: "xai", label: "xAI (Grok)", defaultUrl: "https://api.x.ai", requiresKey: true },
    { value: "featherless", label: "Featherless AI", defaultUrl: "https://api.featherless.ai/v1", requiresKey: true },
    { value: "ollama", label: "Ollama (Local)", defaultUrl: "http://localhost:11434", requiresKey: false },
    { value: "together", label: "Together AI", defaultUrl: "https://api.together.xyz", requiresKey: true },
    { value: "openrouter", label: "OpenRouter", defaultUrl: "https://openrouter.ai/api", requiresKey: true },
    { value: "custom", label: "Custom Provider", defaultUrl: "", requiresKey: true },
];

interface AddModelDialogProps {
    onClose: () => void;
}

export function AddModelDialog({ onClose }: AddModelDialogProps) {
    const { addModel } = useCustomModelStore();

    const [providerType, setProviderType] = useState("openai");
    const [providerName, setProviderName] = useState("");
    const [modelId, setModelId] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [apiKey, setApiKey] = useState("");
    const [contextWindow, setContextWindow] = useState("");

    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const selectedMeta = PROVIDER_OPTIONS.find((p) => p.value === providerType);
    const effectiveBaseUrl = baseUrl.trim() || selectedMeta?.defaultUrl || "";

    // ─── Test Connection ─────────────────────────────────────────────────────

    const handleTest = useCallback(async () => {
        if (!effectiveBaseUrl && providerType === "custom") {
            setTestResult({ success: false, error: "Base URL is required for custom providers" });
            return;
        }

        setTesting(true);
        setTestResult(null);
        setError("");

        try {
            const res = await fetch("/api/custom-models/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    providerType,
                    baseUrl: effectiveBaseUrl,
                    apiKey: apiKey.trim() || undefined,
                    modelId: modelId.trim() || undefined,
                }),
            });

            const data = await res.json();
            setTestResult({ success: data.success, error: data.error });
        } catch (err: any) {
            setTestResult({ success: false, error: err.message || "Connection test failed" });
        } finally {
            setTesting(false);
        }
    }, [providerType, effectiveBaseUrl, apiKey, modelId]);

    // ─── Save ────────────────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        if (!modelId.trim()) {
            setError("Model ID is required");
            return;
        }
        if (!testResult?.success) {
            setError("Please test the connection first");
            return;
        }

        setError("");
        setSaving(true);

        try {
            const res = await fetch("/api/custom-models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    providerType,
                    providerName: providerName.trim() || selectedMeta?.label || providerType,
                    modelId: modelId.trim(),
                    displayName: displayName.trim() || modelId.trim(),
                    baseUrl: effectiveBaseUrl || undefined,
                    apiKey: apiKey.trim() || undefined,
                    contextWindow: contextWindow ? parseInt(contextWindow) : undefined,
                }),
            });

            if (!res.ok) throw new Error("Failed to save model");
            const data = await res.json();
            addModel(data);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    }, [providerType, providerName, modelId, displayName, effectiveBaseUrl, apiKey, contextWindow, testResult, addModel, onClose, selectedMeta]);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-lg border border-border rounded-xl bg-card shadow-2xl relative flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
                                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            <span className="text-[13px] font-medium text-foreground">Add Custom Model</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Form Container */}
                    <div className="px-5 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
                        {/* Provider Type */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                <Cpu className="w-3 h-3" /> Provider Type
                            </label>
                            <Select
                                value={providerType}
                                onValueChange={(v) => {
                                    setProviderType(v);
                                    setTestResult(null);
                                    setBaseUrl("");
                                }}
                            >
                                <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-md z-[10000]">
                                    {PROVIDER_OPTIONS.map((p) => (
                                        <SelectItem key={p.value} value={p.value} className="text-xs rounded-md">
                                            <span className="font-medium">{p.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Provider Name (custom only) */}
                        {providerType === "custom" && (
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                    <Type className="w-3 h-3" /> Provider Name
                                </label>
                                <Input
                                    value={providerName}
                                    onChange={(e) => setProviderName(e.target.value)}
                                    placeholder="My Custom LLM"
                                    className="h-8 text-[12px] rounded-md border-border bg-background"
                                />
                            </div>
                        )}

                        {/* Model ID */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                <Hash className="w-3 h-3" /> Model ID
                            </label>
                            <Input
                                value={modelId}
                                onChange={(e) => { setModelId(e.target.value); setTestResult(null); }}
                                placeholder="e.g. gpt-4o, claude-sonnet-4-20250514, gemini-2.5-pro"
                                className="h-8 text-[12px] rounded-md border-border bg-background font-mono"
                            />
                        </div>

                        {/* Display Name */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                <Type className="w-3 h-3" /> Display Name
                                <span className="text-muted-foreground/50">(optional)</span>
                            </label>
                            <Input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder={modelId || "Friendly name for this model"}
                                className="h-8 text-[12px] rounded-md border-border bg-background"
                            />
                        </div>

                        {/* Base URL */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                <Globe className="w-3 h-3" /> Base URL
                                {providerType !== "custom" && (
                                    <span className="text-muted-foreground/50">(override default)</span>
                                )}
                            </label>
                            <Input
                                value={baseUrl}
                                onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null); }}
                                placeholder={selectedMeta?.defaultUrl || "https://api.example.com"}
                                className="h-8 text-[12px] rounded-md border-border bg-background font-mono"
                            />
                            {selectedMeta?.defaultUrl && !baseUrl && (
                                <p className="text-[10px] text-muted-foreground/50 pl-0.5">
                                    Default: {selectedMeta.defaultUrl}
                                </p>
                            )}
                        </div>

                        {/* API Key */}
                        {(selectedMeta?.requiresKey !== false || providerType === "custom") && (
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                    <Key className="w-3 h-3" /> API Key
                                </label>
                                <Input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                                    placeholder="sk-•••"
                                    className="h-8 text-[12px] rounded-md border-border bg-background font-mono"
                                />
                            </div>
                        )}

                        {/* Context Window */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                                Context Window
                                <span className="text-muted-foreground/50">(optional, tokens)</span>
                            </label>
                            <Input
                                type="number"
                                value={contextWindow}
                                onChange={(e) => setContextWindow(e.target.value)}
                                placeholder="e.g. 128000"
                                className="h-8 text-[12px] rounded-md border-border bg-background"
                            />
                        </div>

                        <Separator className="bg-border/50" />

                        {/* Test + Result */}
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleTest}
                                disabled={testing}
                                variant="outline"
                                size="sm"
                                className="h-8 px-3.5 rounded-md text-[11px] border-border gap-1.5"
                            >
                                {testing ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <TestTube className="w-3 h-3" />
                                )}
                                Test Connection
                            </Button>

                            <AnimatePresence mode="wait">
                                {testResult && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-center gap-1.5"
                                    >
                                        {testResult.success ? (
                                            <>
                                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                <span className="text-[11px] text-emerald-400 font-medium">
                                                    Connection successful
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                                                <span className="text-[11px] text-red-400 font-medium truncate max-w-[200px]">
                                                    {testResult.error || "Connection failed"}
                                                </span>
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Error */}
                        {error && (
                            <p className="text-[11px] text-red-400">{error}</p>
                        )}

                        {/* Save */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <Button
                                onClick={onClose}
                                variant="ghost"
                                size="sm"
                                className="h-8 px-4 rounded-md text-[11px]"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={saving || !testResult?.success}
                                className="h-8 px-5 rounded-md text-[11px] bg-orange-500 text-white hover:bg-orange-600 gap-1.5 disabled:opacity-30"
                            >
                                {saving ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Save className="w-3 h-3" />
                                )}
                                Save Model
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
