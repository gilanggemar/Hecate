"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProviderStore } from "@/store/useProviderStore";
import type { ModelInfo } from "@/lib/providers/types";

interface AgentProviderSettingsProps {
    agentId: string;
    currentModel?: string;
    onProviderChange?: (providerId: string, modelId: string) => void;
}

export function AgentProviderSettings({
    agentId,
    currentModel,
    onProviderChange,
}: AgentProviderSettingsProps) {
    const { providers } = useProviderStore();
    const providerList = Object.values(providers);

    const [selectedProvider, setSelectedProvider] = useState<string>("");
    const [selectedModel, setSelectedModel] = useState<string>(currentModel || "");
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);

    // Load models when provider changes
    useEffect(() => {
        if (!selectedProvider) return;
        setLoadingModels(true);
        fetch(`/api/providers/${selectedProvider}/models`)
            .then((res) => res.json())
            .then((data) => {
                setModels(Array.isArray(data) ? data : []);
            })
            .catch(() => setModels([]))
            .finally(() => setLoadingModels(false));
    }, [selectedProvider]);

    const handleProviderChange = (id: string) => {
        setSelectedProvider(id);
        setSelectedModel("");
    };

    const handleModelChange = (modelId: string) => {
        setSelectedModel(modelId);
        onProviderChange?.(selectedProvider, modelId);
    };

    return (
        <div className="space-y-3">
            {/* Provider selector */}
            <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">Provider</label>
                <Select value={selectedProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                        <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                        {providerList.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="text-xs rounded-lg">
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Model selector */}
            <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    Model
                    {loadingModels && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </label>
                <Select value={selectedModel} onValueChange={handleModelChange} disabled={!selectedProvider || loadingModels}>
                    <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                        <SelectValue placeholder={loadingModels ? "Loading..." : "Select model"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-md">
                        {models.map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs rounded-lg">
                                <div className="flex items-center justify-between w-full gap-3">
                                    <span>{m.name}</span>
                                    {m.contextWindow && (
                                        <span className="text-[10px] text-muted-foreground">
                                            {(m.contextWindow / 1000).toFixed(0)}k ctx
                                        </span>
                                    )}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
