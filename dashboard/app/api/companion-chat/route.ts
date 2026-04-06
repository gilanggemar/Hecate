import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { decryptApiKey } from '@/lib/providers/crypto';
import { compileMemoryBlock, type CompanionMemory } from '@/lib/companion/memoryManager';

/**
 * POST /api/companion-chat
 * Sends a message to the companion model directly (bypassing OpenClaw).
 * Now includes persistent memory injection and background memory extraction.
 *
 * Body: {
 *   agent_id: string,
 *   agent_name?: string,
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
        const { agent_id, agent_name, model_ref, system_prompt, messages, conversation_id, task_type } = body;

        if (!model_ref || !messages) {
            return NextResponse.json(
                { error: 'model_ref and messages are required' },
                { status: 400 }
            );
        }

        // ─── Resolve model credentials ──────────────────────────────────
        const slashIdx = model_ref.indexOf('/');
        const modelIdWithoutProvider = slashIdx > -1 ? model_ref.substring(slashIdx + 1) : model_ref;

        const { data: exactMatch } = await db
            .from('custom_models')
            .select('*')
            .eq('user_id', userId)
            .eq('model_id', model_ref)
            .eq('is_active', true)
            .maybeSingle();

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
            console.log(`[companion-chat] Resolved model: modelId=${modelId}, baseUrl=${baseUrl}`);
        } else {
            baseUrl = process.env.COMPANION_BASE_URL || 'https://api.featherless.ai/v1';
            apiKey = process.env.COMPANION_API_KEY || process.env.FEATHERLESS_API_KEY || '';
            modelId = modelIdWithoutProvider;
            console.log(`[companion-chat] Fallback: modelId=${modelId}, baseUrl=${baseUrl}`);
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: 'No API key found for companion model. Configure the model in Settings.' },
                { status: 400 }
            );
        }

        // ─── Fetch memories for this agent ──────────────────────────────
        let memoryBlock = '';
        let existingFacts: string[] = [];

        try {
            // Fetch facts + moments (up to 30)
            const { data: memories } = await db
                .from('companion_memories')
                .select('*')
                .eq('user_id', userId)
                .eq('agent_id', agent_id)
                .in('memory_type', ['fact', 'moment'])
                .order('importance', { ascending: false })
                .order('updated_at', { ascending: false })
                .limit(30);

            // Fetch recent summaries (up to 5)
            const { data: summaries } = await db
                .from('companion_memories')
                .select('*')
                .eq('user_id', userId)
                .eq('agent_id', agent_id)
                .eq('memory_type', 'summary')
                .order('created_at', { ascending: false })
                .limit(5);

            const memList = (memories || []) as CompanionMemory[];
            const sumList = (summaries || []) as CompanionMemory[];

            // Store existing facts for dedup during extraction
            existingFacts = memList
                .filter(m => m.memory_type === 'fact')
                .map(m => m.content);

            // Compile into a memory block
            memoryBlock = compileMemoryBlock(memList, sumList, agent_name);

            if (memoryBlock) {
                console.log(`[companion-chat] Injecting ${memList.length} memories + ${sumList.length} summaries for ${agent_id}`);
            }
        } catch (memErr) {
            // Memory is non-critical — continue without it
            console.warn('[companion-chat] Memory fetch failed (non-fatal):', memErr);
        }

        // ─── Build messages array with memory injection ─────────────────
        const chatMessages = [];

        // System prompt = persona + memories (injected between persona and conversation)
        if (system_prompt || memoryBlock) {
            const fullSystemPrompt = [
                system_prompt || '',
                memoryBlock,
            ].filter(Boolean).join('\n\n');

            chatMessages.push({ role: 'system', content: fullSystemPrompt });
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

        // Capture the last user message for memory extraction
        const lastUserMessage = messages[messages.length - 1]?.content || '';

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

                            await db.from('conversations').update({
                                updated_at: new Date().toISOString(),
                            }).eq('id', conversation_id);
                        } catch (dbErr) {
                            console.error('[companion-chat] Failed to persist assistant message:', dbErr);
                        }
                    }

                    // ─── Background: Extract memories from this exchange ────
                    // Fire-and-forget — don't block the response
                    if (fullContent && lastUserMessage && agent_id) {
                        extractMemoriesInBackground({
                            userId,
                            agentId: agent_id,
                            agentName: agent_name,
                            modelRef: model_ref,
                            userMessage: lastUserMessage,
                            assistantResponse: fullContent,
                            existingFacts,
                            conversationId: conversation_id,
                            conversationLength: messages.length,
                            baseUrl,
                            apiKey,
                            modelId,
                        }).catch(err => {
                            console.warn('[companion-chat] Background memory extraction failed:', err);
                        });
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

// ─── Background Memory Extraction ───────────────────────────────────────────

interface ExtractionParams {
    userId: string;
    agentId: string;
    agentName?: string;
    modelRef: string;
    userMessage: string;
    assistantResponse: string;
    existingFacts: string[];
    conversationId?: string;
    conversationLength: number;
    baseUrl: string;
    apiKey: string;
    modelId: string;
}

async function extractMemoriesInBackground(params: ExtractionParams) {
    const {
        userId, agentId, agentName, userMessage, assistantResponse,
        existingFacts, conversationId, conversationLength,
        baseUrl, apiKey, modelId,
    } = params;

    const completionUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

    // ─── Extract facts & moments ────────────────────────────────────
    const existingFactsList = existingFacts.length > 0
        ? `\n\nAlready known facts (do NOT repeat these):\n${existingFacts.map(f => `- ${f}`).join('\n')}`
        : '';

    const extractionPrompt = `You are a memory extraction system. Analyze the following conversation exchange between a user and ${agentName || 'an AI companion'} and extract important information worth remembering for future conversations.

Extract ONLY genuinely important, specific information. Do NOT extract:
- Generic pleasantries or greetings
- Information already in the known facts list
- Vague or trivial statements
- Anything the assistant said about itself (only extract what the USER revealed)

For each extracted memory, classify as:
- "fact": Concrete info about the user (name, preferences, occupation, relationships, etc.)
- "moment": Emotionally significant exchange or personal revelation

Rate importance 1-10:
- 1-3: Minor preferences
- 4-6: Meaningful personal details
- 7-9: Core identity, deep emotions, significant life events
- 10: Critical, life-defining information
${existingFactsList}

---
USER: ${userMessage}

${agentName?.toUpperCase() || 'ASSISTANT'}: ${assistantResponse.slice(0, 1000)}
---

Respond with a JSON array ONLY. No explanation, no markdown. If nothing worth remembering, respond with [].
Example: [{"type":"fact","content":"User's name is Alex","importance":8}]`;

    try {
        const response = await fetch(completionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: 'system', content: 'Output ONLY valid JSON arrays. No markdown, no explanation.' },
                    { role: 'user', content: extractionPrompt },
                ],
                temperature: 0.1,
                max_tokens: 512,
            }),
        });

        if (!response.ok) {
            console.warn('[companion-chat] Memory extraction LLM call failed:', response.status);
            return;
        }

        const result = await response.json();
        const rawContent = result.choices?.[0]?.message?.content || '[]';

        let extracted: Array<{ type: string; content: string; importance: number }> = [];
        try {
            const cleaned = rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
                extracted = parsed.filter(
                    (m: any) => m && m.content && (m.type === 'fact' || m.type === 'moment')
                );
            }
        } catch {
            console.warn('[companion-chat] Failed to parse extraction response:', rawContent.slice(0, 200));
            return;
        }

        // Save extracted memories
        if (extracted.length > 0) {
            const existingSet = new Set(existingFacts.map(f => f.toLowerCase().trim()));
            const toInsert = extracted
                .filter(m => !existingSet.has(m.content.toLowerCase().trim()))
                .map(m => ({
                    user_id: userId,
                    agent_id: agentId,
                    memory_type: m.type,
                    content: m.content.trim(),
                    importance: Math.min(10, Math.max(1, m.importance || 5)),
                    source_conversation_id: conversationId || null,
                }));

            if (toInsert.length > 0) {
                const { error } = await db.from('companion_memories').insert(toInsert);
                if (error) {
                    console.warn('[companion-chat] Memory insert failed:', error.message);
                } else {
                    console.log(`[companion-chat] ✓ Extracted & saved ${toInsert.length} memories for ${agentId}`);
                }
            }
        }

        // ─── Generate conversation summary every ~10 messages ────────
        if (conversationLength > 0 && conversationLength % 10 === 0 && conversationId) {
            try {
                const summaryRes = await fetch(completionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: [
                            { role: 'system', content: 'Summarize in 1-2 concise sentences. No preamble.' },
                            { role: 'user', content: `Summarize this conversation exchange:\n\nUSER: ${userMessage}\n\n${agentName?.toUpperCase() || 'ASSISTANT'}: ${assistantResponse.slice(0, 500)}` },
                        ],
                        temperature: 0.3,
                        max_tokens: 150,
                    }),
                });

                if (summaryRes.ok) {
                    const summaryResult = await summaryRes.json();
                    const summary = summaryResult.choices?.[0]?.message?.content?.trim();
                    if (summary) {
                        await db.from('companion_memories').insert({
                            user_id: userId,
                            agent_id: agentId,
                            memory_type: 'summary',
                            content: summary,
                            importance: 5,
                            source_conversation_id: conversationId,
                        });
                        console.log(`[companion-chat] ✓ Saved conversation summary for ${agentId}`);
                    }
                }
            } catch {
                // Summary is non-critical
            }
        }
    } catch (err) {
        console.warn('[companion-chat] Memory extraction error:', err);
    }
}
