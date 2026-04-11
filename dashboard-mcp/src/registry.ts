// ─── Tool Registry ───────────────────────────────────────────────────────────
// Drop-in extensibility: each tool file exports a `register` function.
// New domains = new file in tools/ + one import in index.ts. That's it.
// ──────────────────────────────────────────────────────────────────────────────

import { type Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z, type ZodRawShape } from "zod";
import { toolName } from "./config.js";
import { getSupabase } from "./supabase.js";
import { getUserId } from "./config.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolDefinition {
    /** Domain name, e.g. "tasks", "agents" */
    domain: string;
    /** Action name, e.g. "list", "create" */
    action: string;
    /** Tool description shown to the agent */
    description: string;
    /** Zod schema for the input parameters */
    inputSchema: ZodRawShape;
    /** Handler that executes the tool */
    handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
}

// ─── Global Tool Store ───────────────────────────────────────────────────────

const _tools: Map<string, ToolDefinition> = new Map();

/** Register a single tool */
export function registerTool(def: ToolDefinition): void {
    const name = toolName(def.domain, def.action);
    _tools.set(name, def);
}

/** Register multiple tools at once (convenience for domain files) */
export function registerTools(defs: ToolDefinition[]): void {
    for (const def of defs) registerTool(def);
}

/** Get all registered tools */
export function getAllTools(): Map<string, ToolDefinition> {
    return _tools;
}

// ─── Helpers for tool authors ────────────────────────────────────────────────

/** Create a success result */
export function ok(data: unknown): ToolResult {
    return {
        content: [
            { type: "text", text: JSON.stringify(data, null, 2) },
        ],
    };
}

/** Create an error result */
export function err(message: string): ToolResult {
    return {
        content: [{ type: "text", text: JSON.stringify({ error: message }) }],
        isError: true,
    };
}

/** Shorthand to get a typed Supabase client + user_id scoping */
export function db() {
    return { supabase: getSupabase(), userId: getUserId() };
}

/**
 * Convert Zod raw shape to JSON Schema for MCP tool listing.
 * This produces a simplified JSON Schema from Zod shapes.
 */
export function zodShapeToJsonSchema(shape: ZodRawShape): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
        const zodType = value as z.ZodTypeAny;
        const desc = zodType.description;
        const jsonProp: Record<string, unknown> = {};

        // Unwrap optional
        let inner = zodType;
        let isOptional = false;
        if (inner instanceof z.ZodOptional) {
            isOptional = true;
            inner = inner.unwrap();
        }
        if (inner instanceof z.ZodDefault) {
            isOptional = true;
            inner = inner.removeDefault();
        }

        // Map Zod type to JSON Schema type
        if (inner instanceof z.ZodString) {
            jsonProp.type = "string";
        } else if (inner instanceof z.ZodNumber) {
            jsonProp.type = "number";
        } else if (inner instanceof z.ZodBoolean) {
            jsonProp.type = "boolean";
        } else if (inner instanceof z.ZodEnum) {
            jsonProp.type = "string";
            jsonProp.enum = inner.options;
        } else if (inner instanceof z.ZodArray) {
            jsonProp.type = "array";
        } else if (inner instanceof z.ZodObject) {
            jsonProp.type = "object";
        } else {
            jsonProp.type = "string"; // fallback
        }

        if (desc) jsonProp.description = desc;
        properties[key] = jsonProp;

        if (!isOptional) required.push(key);
    }

    return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
    };
}
