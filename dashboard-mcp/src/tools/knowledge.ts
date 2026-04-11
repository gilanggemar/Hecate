// ─── Knowledge Domain ────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "knowledge";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list_documents",
        description: "List knowledge documents. Optionally filter by agent or source type.",
        inputSchema: {
            agent_id: z.string().optional().describe("Filter by agent ID"),
            source_type: z.string().optional().describe("Filter by source_type (e.g. 'file', 'web', 'api')"),
            limit: z.number().optional().default(50).describe("Max results"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("knowledge_documents")
                .select("id, agent_id, file_name, file_type, size_bytes, source, source_type, indexed, created_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
            if (params.source_type) query = query.eq("source_type", params.source_type as string);
            query = query.limit((params.limit as number) || 50);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ documents: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "get_document",
        description: "Get full content of a knowledge document.",
        inputSchema: {
            document_id: z.string().describe("Document ID"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("knowledge_documents")
                .select("*")
                .eq("id", params.document_id as string)
                .eq("user_id", userId)
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "create_document",
        description: "Create a new knowledge document for an agent.",
        inputSchema: {
            agent_id: z.string().optional().describe("Agent to associate the document with"),
            file_name: z.string().describe("File name"),
            content: z.string().describe("Document content (text)"),
            file_type: z.string().optional().describe("MIME type or extension"),
            source: z.string().optional().describe("Source label"),
            source_type: z.string().optional().describe("Source type (file, web, api, manual)"),
            source_url: z.string().optional().describe("Source URL if applicable"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const { data, error } = await supabase
                .from("knowledge_documents")
                .insert({
                    id,
                    agent_id: params.agent_id || null,
                    file_name: params.file_name,
                    content: params.content,
                    text: params.content,
                    file_type: params.file_type || null,
                    size_bytes: new TextEncoder().encode(params.content as string).length,
                    source: params.source || null,
                    source_type: params.source_type || "manual",
                    source_url: params.source_url || null,
                    indexed: false,
                    user_id: userId,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "delete_document",
        description: "Delete a knowledge document.",
        inputSchema: {
            document_id: z.string().describe("Document ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { error } = await supabase
                .from("knowledge_documents")
                .delete()
                .eq("id", params.document_id as string)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true, document_id: params.document_id });
        },
    },
    {
        domain: DOMAIN,
        action: "search",
        description: "Search knowledge fragments by content. Returns matching fragments ordered by importance.",
        inputSchema: {
            query: z.string().describe("Search query text"),
            agent_id: z.string().optional().describe("Scope search to an agent"),
            limit: z.number().optional().default(10).describe("Max results"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("knowledge_fragments")
                .select("*")
                .eq("user_id", userId)
                .ilike("content", `%${params.query}%`)
                .order("importance", { ascending: false });

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
            query = query.limit((params.limit as number) || 10);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ fragments: data, count: data?.length ?? 0 });
        },
    },
];

registerTools(tools);
