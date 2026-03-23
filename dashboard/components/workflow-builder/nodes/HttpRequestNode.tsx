"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Globe } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

const METHOD_COLORS: Record<string, string> = {
    GET: "oklch(0.72 0.14 145)",
    POST: "oklch(0.72 0.18 55)",
    PUT: "oklch(0.72 0.14 195)",
    DELETE: "oklch(0.65 0.19 25)",
    PATCH: "oklch(0.70 0.15 290)",
};

export function HttpRequestNode(props: NodeProps) {
    const d = props.data as any;
    const method = (d.method || "GET").toUpperCase();
    const url = d.url || "";

    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.http_request}
            icon={<Globe size={14} />}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                        fontSize: 8, fontWeight: 700, textTransform: "uppercase",
                        padding: "2px 5px", borderRadius: 3,
                        background: `${METHOD_COLORS[method] || "var(--text-muted)"}20`,
                        color: METHOD_COLORS[method] || "var(--text-muted)",
                        letterSpacing: "0.04em",
                    }}>
                        {method}
                    </span>
                </div>
                {url && (
                    <div style={{
                        fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace",
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", maxWidth: 170,
                    }}>
                        {url}
                    </div>
                )}
                {!url && (
                    <div style={{ fontSize: 9, color: "var(--text-muted)", fontStyle: "italic" }}>
                        No URL configured
                    </div>
                )}
            </div>
        </BaseNodeV2>
    );
}
