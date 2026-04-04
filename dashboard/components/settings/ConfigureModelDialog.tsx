"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings2, X, Search, Cpu, Globe, Key, Hash, User, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCustomModelStore, type CustomModel } from "@/stores/useCustomModelStore";
import { useOpenClawModelStore, type ModelCatalogEntry } from "@/stores/useOpenClawModelStore";
import { cn } from "@/lib/utils";

interface ConfigureModelDialogProps {
    onClose: () => void;
}

export function ConfigureModelDialog({ onClose }: ConfigureModelDialogProps) {
    const { models: customModels, removeModel } = useCustomModelStore();
    const { modelCatalog } = useOpenClawModelStore();
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Build unified list: custom models first, then catalog-only entries
    const configuredModels = useMemo(() => {
        const items: {
            id: string;
            ref: string;
            provider: string;
            modelName: string;
            displayName?: string;
            baseUrl?: string;
            maskedKey?: string;
            account?: string;
            isCustom: boolean;
            contextWindow?: number;
            createdAt?: string;
        }[] = [];

        // Track which refs are covered by custom models
        const customRefs = new Set<string>();

        // Custom models (full config available)
        for (const cm of customModels) {
            const ref = `${cm.providerType}/${cm.modelId}`;
            customRefs.add(ref);
            items.push({
                id: cm.id,
                ref,
                provider: cm.providerName || cm.providerType,
                modelName: cm.modelId,
                displayName: cm.displayName,
                baseUrl: cm.baseUrl,
                maskedKey: cm.maskedKey,
                account: cm.maskedKey ? `API Key: ${cm.maskedKey}` : undefined,
                isCustom: true,
                contextWindow: cm.contextWindow,
                createdAt: cm.createdAt,
            });
        }

        // Catalog models from OpenClaw that aren't in custom list
        for (const cat of modelCatalog) {
            if (!customRefs.has(cat.ref)) {
                items.push({
                    id: `catalog-${cat.ref}`,
                    ref: cat.ref,
                    provider: cat.provider,
                    modelName: cat.modelName,
                    displayName: cat.alias,
                    baseUrl: cat.baseUrl,
                    maskedKey: cat.apiKeyHint,
                    account: cat.account || cat.apiKeyHint ? `${cat.account || ''}${cat.account && cat.apiKeyHint ? ' · ' : ''}${cat.apiKeyHint || ''}` : undefined,
                    isCustom: false,
                });
            }
        }

        return items;
    }, [customModels, modelCatalog]);

    const filtered = search.trim()
        ? configuredModels.filter(
              (m) =>
                  m.ref.toLowerCase().includes(search.toLowerCase()) ||
                  m.provider.toLowerCase().includes(search.toLowerCase()) ||
                  m.modelName.toLowerCase().includes(search.toLowerCase()) ||
                  (m.displayName && m.displayName.toLowerCase().includes(search.toLowerCase())) ||
                  (m.account && m.account.toLowerCase().includes(search.toLowerCase()))
          )
        : configuredModels;

    const handleDelete = async (id: string, isCustom: boolean) => {
        if (!isCustom) return; // Can only delete custom models
        setDeletingId(id);
        try {
            await removeModel(id);
        } finally {
            setDeletingId(null);
        }
    };

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
                            <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
                                <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <span className="text-[13px] font-medium text-foreground">Configured Models</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="px-5 pt-4 pb-2 shrink-0">
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border border-border">
                            <Search size={12} className="text-muted-foreground shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search configured models..."
                                autoFocus
                                className="bg-transparent outline-none text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 w-full"
                            />
                        </div>
                    </div>

                    {/* Model List */}
                    <div className="px-5 py-3 overflow-y-auto min-h-0 flex-1 space-y-1.5">
                        {filtered.length === 0 ? (
                            <div className="py-8 text-center">
                                <Cpu className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
                                <p className="text-[11px] text-muted-foreground/50">
                                    No configured models found
                                </p>
                            </div>
                        ) : (
                            filtered.map((model) => {
                                const isExpanded = expandedId === model.id;
                                return (
                                    <div
                                        key={model.id}
                                        className={cn(
                                            "border rounded-lg transition-all duration-150",
                                            isExpanded
                                                ? "border-border bg-muted/10"
                                                : "border-border/50 bg-card/50 hover:border-border"
                                        )}
                                    >
                                        {/* Row header */}
                                        <div className="flex items-center">
                                            <button
                                                onClick={() => setExpandedId(isExpanded ? null : model.id)}
                                                className="flex-1 flex items-center justify-between px-3 py-2.5 text-left group min-w-0"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className={cn(
                                                            "size-1.5 rounded-full shrink-0",
                                                            model.isCustom ? "bg-emerald-400" : "bg-muted-foreground/30"
                                                        )}
                                                    />
                                                    <span className="text-[11px] font-mono truncate">
                                                        <span className="text-muted-foreground">{model.provider}/</span>
                                                        <span className="text-foreground font-medium">{model.modelName}</span>
                                                    </span>
                                                    {model.isCustom && (
                                                        <span className="text-[9px] text-emerald-400/70 font-sans shrink-0" title="Custom model">★</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    {model.account && (
                                                        <span className="text-[9px] text-muted-foreground/60 font-mono truncate max-w-[120px]">
                                                            {model.account}
                                                        </span>
                                                    )}
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                                    )}
                                                </div>
                                            </button>
                                            {/* Delete button - always visible */}
                                            <button
                                                onClick={() => {
                                                    if (model.isCustom) {
                                                        handleDelete(model.id, true);
                                                    }
                                                }}
                                                disabled={!model.isCustom || deletingId === model.id}
                                                className={cn(
                                                    "p-2 mr-1 rounded-md transition-colors shrink-0",
                                                    model.isCustom
                                                        ? "hover:bg-red-500/15 text-muted-foreground/40 hover:text-red-400"
                                                        : "text-muted-foreground/15 cursor-not-allowed"
                                                )}
                                                title={model.isCustom ? "Remove model" : "OpenClaw model (managed externally)"}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>

                                        {/* Expanded details */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                                                        {/* Ref */}
                                                        <DetailRow icon={<Hash className="w-3 h-3" />} label="Ref" value={model.ref} mono />

                                                        {/* Display Name */}
                                                        {model.displayName && (
                                                            <DetailRow icon={<Cpu className="w-3 h-3" />} label="Name" value={model.displayName} />
                                                        )}

                                                        {/* Base URL */}
                                                        {model.baseUrl && (
                                                            <DetailRow icon={<Globe className="w-3 h-3" />} label="URL" value={model.baseUrl} mono />
                                                        )}

                                                        {/* API Key */}
                                                        {model.maskedKey && (
                                                            <DetailRow icon={<Key className="w-3 h-3" />} label="Key" value={model.maskedKey} mono />
                                                        )}

                                                        {/* Account */}
                                                        {model.account && (
                                                            <DetailRow icon={<User className="w-3 h-3" />} label="Account" value={model.account} />
                                                        )}

                                                        {/* Context Window */}
                                                        {model.contextWindow && (
                                                            <DetailRow icon={<span className="w-3 h-3 text-center text-[9px]">ctx</span>} label="Context" value={`${model.contextWindow.toLocaleString()} tokens`} />
                                                        )}

                                                        {/* Source */}
                                                        <DetailRow 
                                                            icon={<span className="w-3 h-3" />} 
                                                            label="Source" 
                                                            value={model.isCustom ? "Custom (Dashboard)" : "OpenClaw Gateway"} 
                                                        />

                                                        {/* Created */}
                                                        {model.createdAt && (
                                                            <DetailRow icon={<span className="w-3 h-3" />} label="Added" value={new Date(model.createdAt).toLocaleDateString()} />
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-border/50 shrink-0">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground/50">
                                {configuredModels.length} model{configuredModels.length !== 1 ? "s" : ""} configured
                                {customModels.filter((m) => m.isActive).length > 0 && (
                                    <> · {customModels.filter((m) => m.isActive).length} custom</>
                                )}
                            </span>
                            <Button
                                onClick={onClose}
                                variant="ghost"
                                size="sm"
                                className="h-7 px-4 rounded-md text-[11px]"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

// Small helper for detail rows
function DetailRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-muted-foreground/50 shrink-0">{icon}</span>
            <span className="text-[10px] text-muted-foreground/60 w-14 shrink-0">{label}</span>
            <span className={cn("text-[10px] text-foreground/80 truncate", mono && "font-mono")}>{value}</span>
        </div>
    );
}
