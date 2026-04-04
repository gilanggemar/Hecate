import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { decryptApiKey } from '@/lib/providers/crypto';

/**
 * POST /api/companion-chat
 * Sends a message to the companion model directly (bypassing OpenClaw).
 *
 * Body: {
 *   agent_id: string,
 *   model_ref: string,        // e.g. "featherless/model-name" or custom model ID
 *   system_prompt: string,    // compiled COMPANION.md markdown
 *   messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>,
 *   conversation_id?: string,
 * }
 *
 * Streams response as text/event-stream.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { model_ref, system_prompt, messages, conversation_id, task_type } = body;
        // task_type: 'chat' | 'coding' | 'tool_call' | 'function_call' | 'vision' (defaults to 'chat')

        if (!model_ref || !messages) {
            return NextResponse.json(
                { error: 'model_ref and messages are required' },
                { status: 400 }
            );
        }

        // ─── Resolve model credentials ──────────────────────────────────
        // model_ref comes from the UI as "provider/model_id" (e.g., "featherless/Steelskull/L3.3-Electra-R1-70b")
        // But custom_models stores just the model_id (e.g., "Steelskull/L3.3-Electra-R1-70b")
        // So we need to try: exact match, then strip provider prefix, then fuzzy match.

        // 1) Try exact match first (in case model_ref == model_id)
        const { data: exactMatch } = await db
            .from('custom_models')
            .select('*')
            .eq('user_id', userId)
            .eq('model_id', model_ref)
            .eq('is_active', true)
            .maybeSingle();

        // 2) Strip provider prefix: "featherless/Steelskull/L3.3-Electra-R1-70b" → "Steelskull/L3.3-Electra-R1-70b"
        const slashIdx = model_ref.indexOf('/');
        const modelIdWithoutProvider = slashIdx > -1 ? model_ref.substring(slashIdx + 1) : model_ref;

        let prefixMatch = null;
        if (!exactMatch && modelIdWithoutProvider !== model_ref) {
            const { data } = await db
                .from('custom_models')
                .select('*')
                .eq('user_id', userId)
                .eq('model_id', modelIdWithoutProvider)
                .eq('is_active', true)
                .maybeSingle();
            prefixMatch = data;
        }

        // 3) Fuzzy match on the final model name segment as last resort
        let fuzzyMatch = null;
        if (!exactMatch && !prefixMatch) {
            const lastSegment = model_ref.split('/').pop() || model_ref;
            const { data } = await db
                .from('custom_models')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .ilike('model_id', `%${lastSegment}%`)
                .maybeSingle();
            fuzzyMatch = data;
        }

        const customModel = exactMatch || prefixMatch || fuzzyMatch;

        let baseUrl: string;
        let apiKey: string;
        let modelId: string;

        if (customModel) {
            baseUrl = customModel.base_url || 'https://api.openai.com/v1';
            apiKey = customModel.encrypted_api_key
                ? decryptApiKey(customModel.encrypted_api_key)
                : '';
            modelId = customModel.model_id;
            console.log(`[companion-chat] Resolved model from custom_models: modelId=${modelId}, baseUrl=${baseUrl}`);
        } else {
            // Fallback: use the model_ref as-is with environment API key
            baseUrl = process.env.COMPANION_BASE_URL || 'https://api.featherless.ai/v1';
            apiKey = process.env.COMPANION_API_KEY || process.env.FEATHERLESS_API_KEY || '';
            // Use the version without provider prefix as the modelId for the API call
            modelId = modelIdWithoutProvider;
            console.log(`[companion-chat] Fallback: modelId=${modelId}, baseUrl=${baseUrl} (no custom_models match for ref="${model_ref}")`);
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: 'No API key found for companion model. Configure the model in Settings.' },
                { status: 400 }
            );
        }

        // ─── Build messages array ───────────────────────────────────────
        const chatMessages = [];

        // System prompt from companion profile
        if (system_prompt) {
            chatMessages.push({ role: 'system', content: system_prompt });
        }

        // Conversation history + current message
        chatMessages.push(...messages);

        // ─── Call the model API (OpenAI-compatible) ─────────────────────
        const completionUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

        const response = await fetch(completionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                messages: chatMessages,
                stream: true,
                temperature: 0.85,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[companion-chat] Model API error:', response.status, errorText);
            return NextResponse.json(
                { error: `Model API error: ${response.status} — ${errorText.slice(0, 200)}` },
                { status: 502 }
            );
        }

        // ─── Stream the response back ───────────────────────────────────
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
            async start(controller) {
                const reader = response.body?.getReader();
                if (!reader) {
                    controller.close();
                    return;
                }

                let fullContent = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');

                        for (const line of lines) {
                            if (!line.startsWith('data: ')) continue;
                            const data = line.slice(6).trim();
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                const delta = parsed.choices?.[0]?.delta?.content;
                                if (delta) {
                                    fullContent += delta;
                                    // Forward the SSE chunk to the client
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
                                }
                            } catch {
                                // Skip unparseable chunks
                            }
                        }
                    }

                    // Send final event
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullContent })}\n\n`));

                    // ─── Persist assistant message to Supabase ──────────────
                    if (conversation_id && fullContent) {
                        try {
                            await db.from('conversation_messages').insert({
                                id: crypto.randomUUID(),
                                conversation_id,
                                role: 'assistant',
                                content: fullContent,
                                metadata: { source: 'companion', model: modelId },
                            });

                            // Update conversation timestamp
                            await db.from('conversations').update({
                                updated_at: new Date().toISOString(),
                            }).eq('id', conversation_id);
                        } catch (dbErr) {
                            console.error('[companion-chat] Failed to persist assistant message:', dbErr);
                        }
                    }
                } catch (err) {
                    console.error('[companion-chat] Stream error:', err);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: unknown) {
        console.error('[companion-chat POST]', error);
        return NextResponse.json({ error: 'Failed to send companion message' }, { status: 500 });
    }
}
