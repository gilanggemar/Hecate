// ─── Chat Domain ─────────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "chat";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list_conversations",
        description:
            "List conversations. Optionally filter by agent, pinned/archived status, or mode.",
        inputSchema: {
            agent_id: z.string().optional().describe("Filter by agent ID"),
            pinned: z.boolean().optional().describe("Filter by pinned status"),
            archived: z.boolean().optional().describe("Filter by archived status"),
            mode: z.enum(["agent", "companion"]).optional().describe("Filter by conversation mode"),
            limit: z.number().optional().default(30).describe("Max results"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("conversations")
                .select("*")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false });

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
            if (params.pinned !== undefined) query = query.eq("pinned", params.pinned as boolean);
            if (params.archived !== undefined) query = query.eq("archived", params.archived as boolean);
            if (params.mode) query = query.eq("mode", params.mode as string);
            query = query.limit((params.limit as number) || 30);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ conversations: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "get_messages",
        description:
            "Get messages for a conversation, ordered chronologically. Supports pagination.",
        inputSchema: {
            conversation_id: z.string().describe("Conversation ID"),
            limit: z.number().optional().default(50).describe("Max messages to return"),
            offset: z.number().optional().default(0).describe("Offset for pagination"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("conversation_messages")
                .select("*")
                .eq("conversation_id", params.conversation_id as string)
                .eq("user_id", userId)
                .order("sequence_number", { ascending: true })
                .range(
                    (params.offset as number) || 0,
                    ((params.offset as number) || 0) + ((params.limit as number) || 50) - 1
                );
            if (error) return err(error.message);
            return ok({ messages: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "send_message",
        description:
            "Post a new message to an existing conversation. Use role 'user' for operator messages or 'system' for automated instructions.",
        inputSchema: {
            conversation_id: z.string().describe("Conversation ID"),
            role: z.enum(["user", "assistant", "system", "tool"]).describe("Message role"),
            content: z.string().describe("Message content (supports markdown)"),
            metadata: z.object({}).optional().describe("Optional metadata JSON"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();

            // Get current max sequence number
            const { data: lastMsg } = await supabase
                .from("conversation_messages")
                .select("sequence_number")
                .eq("conversation_id", params.conversation_id as string)
                .eq("user_id", userId)
                .order("sequence_number", { ascending: false })
                .limit(1)
                .single();

            const nextSeq = (lastMsg?.sequence_number || 0) + 1;

            const { data, error } = await supabase
                .from("conversation_messages")
                .insert({
                    conversation_id: params.conversation_id,
                    role: params.role,
                    content: params.content,
                    metadata: params.metadata || {},
                    sequence_number: nextSeq,
                    user_id: userId,
                })
                .select()
                .single();
            if (error) return err(error.message);

            // Update conversation's updated_at and message_count
            await supabase
                .from("conversations")
                .update({
                    updated_at: new Date().toISOString(),
                    message_count: nextSeq,
                })
                .eq("id", params.conversation_id as string)
                .eq("user_id", userId);

            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "create_conversation",
        description: "Start a new conversation with an agent.",
        inputSchema: {
            agent_id: z.string().describe("Agent ID for the conversation"),
            title: z.string().optional().describe("Conversation title"),
            mode: z.enum(["agent", "companion"]).optional().default("agent").describe("Conversation mode"),
            project_id: z.string().optional().describe("Associated project ID"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from("conversations")
                .insert({
                    id,
                    agent_id: params.agent_id,
                    title: params.title || null,
                    mode: params.mode || "agent",
                    project_id: params.project_id || null,
                    message_count: 0,
                    pinned: false,
                    archived: false,
                    user_id: userId,
                    created_at: now,
                    updated_at: now,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "pin_conversation",
        description: "Pin or unpin a conversation.",
        inputSchema: {
            conversation_id: z.string().describe("Conversation ID"),
            pinned: z.boolean().describe("True to pin, false to unpin"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("conversations")
                .update({ pinned: params.pinned, updated_at: new Date().toISOString() })
                .eq("id", params.conversation_id as string)
                .eq("user_id", userId)
                .select("id, title, pinned")
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "archive_conversation",
        description: "Archive or unarchive a conversation.",
        inputSchema: {
            conversation_id: z.string().describe("Conversation ID"),
            archived: z.boolean().describe("True to archive, false to unarchive"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("conversations")
                .update({ archived: params.archived, updated_at: new Date().toISOString() })
                .eq("id", params.conversation_id as string)
                .eq("user_id", userId)
                .select("id, title, archived")
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
];

registerTools(tools);
