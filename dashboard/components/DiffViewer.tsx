"use client";

import { cn } from "@/lib/utils";

interface DiffViewerProps {
    diffPayload: string;
    className?: string;
}

/**
 * Side-by-side diff viewer for code changes.
 * Expects a unified diff string (lines prefixed with +, -, or space).
 */
export function DiffViewer({ diffPayload, className }: DiffViewerProps) {
    const lines = diffPayload.split('\n');

    return (
        <div className={cn("rounded-md border border-border overflow-hidden font-mono text-[11px]", className)}>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <tbody>
                        {lines.map((line, i) => {
                            const isAdd = line.startsWith('+');
                            const isRemove = line.startsWith('-');
                            const isHeader = line.startsWith('@@') || line.startsWith('diff') || line.startsWith('---') || line.startsWith('+++');

                            return (
                                <tr key={i} className={cn(
                                    isAdd && "bg-emerald-500/8",
                                    isRemove && "bg-red-500/8",
                                    isHeader && "bg-accent/50",
                                )}>
                                    <td className="px-2 py-0.5 text-right text-muted-foreground/30 select-none w-10 border-r border-border/30">
                                        {i + 1}
                                    </td>
                                    <td className={cn(
                                        "px-3 py-0.5 whitespace-pre",
                                        isAdd && "text-emerald-400",
                                        isRemove && "text-red-400",
                                        isHeader && "text-blue-400/70",
                                        !isAdd && !isRemove && !isHeader && "text-muted-foreground",
                                    )}>
                                        {line}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
