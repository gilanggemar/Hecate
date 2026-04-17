"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTaskStore } from "@/lib/useTaskStore";
import { usePMStore } from "@/store/usePMStore";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * useRealtimeTasks — subscribes to Supabase Realtime on the `tasks` table.
 *
 * When any row is INSERT/UPDATE/DELETE'd (from any source — the dashboard,
 * the OpenClaw plugin, a direct API call), this hook pushes the change into
 * both useTaskStore and usePMStore so the UI updates instantly.
 *
 * Mount this ONCE at the app layout level.
 */
export function useRealtimeTasks() {
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel("realtime:tasks")
            .on(
                "postgres_changes",
                {
                    event: "*",          // INSERT, UPDATE, DELETE
                    schema: "public",
                    table: "tasks",
                },
                (payload) => {
                    const eventType = payload.eventType;
                    const newRecord = payload.new as Record<string, any> | undefined;
                    const oldRecord = payload.old as Record<string, any> | undefined;

                    // ── Task-Ops store (useTaskStore) ──
                    const taskStore = useTaskStore.getState();

                    // ── PM store (usePMStore) ──
                    const pmStore = usePMStore.getState();

                    if (eventType === "INSERT" && newRecord) {
                        handleInsert(newRecord, taskStore, pmStore);
                    } else if (eventType === "UPDATE" && newRecord) {
                        handleUpdate(newRecord, taskStore, pmStore);
                    } else if (eventType === "DELETE" && oldRecord) {
                        handleDelete(oldRecord, taskStore, pmStore);
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, []);
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function handleInsert(
    row: Record<string, any>,
    taskStore: ReturnType<typeof useTaskStore.getState>,
    pmStore: ReturnType<typeof usePMStore.getState>
) {
    // Task-Ops store: add if not already present and not pm_only
    const cf = row.custom_fields || {};
    const isPmOnly = cf.pm_only === true;

    if (!isPmOnly) {
        const exists = taskStore.tasks.some((t) => t.id === row.id);
        if (!exists) {
            useTaskStore.setState((state) => ({
                tasks: [mapToTaskOps(row), ...state.tasks],
            }));
        }
    }

    // PM store: add if it has a space_id (PM task) and not already present
    if (row.space_id) {
        const exists = pmStore.tasks.some((t) => t.id === row.id);
        if (!exists) {
            usePMStore.setState((state) => ({
                tasks: [mapToPMTask(row), ...state.tasks],
            }));
        }
    }

    // Agent-card tasks: always refresh if the task has an agent_id
    // (The agent card filters by agentId from the taskStore)
    if (row.agent_id && !isPmOnly) {
        const exists = taskStore.tasks.some((t) => t.id === row.id);
        if (!exists) {
            useTaskStore.setState((state) => ({
                tasks: [mapToTaskOps(row), ...state.tasks],
            }));
        }
    }
}

function handleUpdate(
    row: Record<string, any>,
    taskStore: ReturnType<typeof useTaskStore.getState>,
    pmStore: ReturnType<typeof usePMStore.getState>
) {
    // Task-Ops store
    useTaskStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
            t.id === row.id
                ? { ...t, ...mapToTaskOps(row) }
                : t
        ),
    }));

    // PM store
    usePMStore.setState((state) => ({
        tasks: state.tasks.map((t) =>
            t.id === row.id
                ? { ...t, ...mapToPMTask(row) }
                : t
        ),
    }));
}

function handleDelete(
    row: Record<string, any>,
    taskStore: ReturnType<typeof useTaskStore.getState>,
    pmStore: ReturnType<typeof usePMStore.getState>
) {
    const id = row.id;
    if (!id) return;

    useTaskStore.setState((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
    }));

    usePMStore.setState((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
    }));
}

/* ─── Row → Store mappers ─────────────────────────────────────────────────── */

function mapToTaskOps(row: Record<string, any>) {
    const cf = row.custom_fields || {};
    return {
        id: row.id,
        title: row.title || "Untitled",
        description: row.description || undefined,
        agentId: row.agent_id || "",
        status: row.status || "PENDING",
        priority: mapPriority(row.priority),
        updatedAt: Date.now(),
        timestamp: new Date(row.updated_at || Date.now()).toLocaleTimeString(),
        executionPlan: cf.execution_plan || undefined,
        systemPrompt: cf.system_prompt || undefined,
        goals: cf.goals || undefined,
        constraints: cf.constraints || undefined,
    };
}

function mapToPMTask(row: Record<string, any>) {
    return {
        id: row.id,
        user_id: row.user_id || "",
        agent_id: row.agent_id || null,
        title: row.title || "Untitled",
        description: row.description || null,
        status: row.status || "PENDING",
        priority: row.priority ?? 1,
        assignee_type: row.assignee_type || "agent",
        space_id: row.space_id || null,
        folder_id: row.folder_id || null,
        project_id: row.project_id || null,
        parent_task_id: row.parent_task_id || null,
        start_date: row.start_date || null,
        due_date: row.due_date || null,
        completed_at: row.completed_at || null,
        progress: row.progress || 0,
        sort_order: row.sort_order || 0,
        custom_fields: row.custom_fields || {},
        tags: row.tags || [],
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
    };
}

/** Map numeric (0-3) or string priority to TaskOps string priority */
function mapPriority(p: any): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (typeof p === "string") {
        const upper = p.toUpperCase();
        if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(upper)) return upper as any;
    }
    if (typeof p === "number") {
        if (p <= 0) return "LOW";
        if (p === 1) return "MEDIUM";
        if (p === 2) return "HIGH";
        return "CRITICAL";
    }
    return "MEDIUM";
}
