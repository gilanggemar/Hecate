import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { decryptApiKey } from '@/lib/providers/crypto';

/**
 * POST /api/companion-memory/extract
 * Uses the companion LLM to extract memories from a conversation exchange.
 *
 * Body: {
 *   agent_id: string,
 *   agent_name: string,
 *   model_ref: string,
 *   user_message: string,
 *   assistant_response: string,
 *   existing_facts: string[],         // already-known facts (for dedup)
 *   conversation_id?: string,
 *   conversation_length?: number,      // total message count (for summary trigger)
 * }
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const {
            agent_id,
            agent_name,
            model_ref,
            user_message,
            assistant_response,
            existing_facts = [],
            conversation_id,
            conversation_length = 0,
        } = body;

        if (!agent_id || !model_ref || !user_message || !assistant_response) {
            return NextResponse.json(
                { error: 'agent_id, model_ref, user_message, and assistant_response are required' },
                { status: 400 }
            );
        }

        // ─── Resolve model credentials (same logic as companion-chat) ────
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
        } else {
            baseUrl = process.env.COMPANION_BASE_URL || 'https://api.featherless.ai/v1';
            apiKey = process.env.COMPANION_API_KEY || process.env.FEATHERLESS_API_KEY || '';
            modelId = modelIdWithoutProvider;
        }

        if (!apiKey) {
            return NextResponse.json({ extracted: [], error: 'No API key for extraction' }, { status: 200 });
        }

        // ─── Build extraction prompt ────────────────────────────────────
        const existingFactsList = existing_facts.length > 0
            ? `\n\nAlready known facts (do NOT repeat these):\n${existing_facts.map((f: string) => `- ${f}`).join('\n')}`
            : '';

        const extractionPrompt = `You are a memory extraction system. Analyze the following conversation exchange between a user and ${agent_name || 'an AI companion'} and extract important information worth remembering for future conversations.

Extract ONLY genuinely important, specific information. Do NOT extract:
- Generic pleasantries or greetings
- Information already in the known facts list
- Vague or trivial statements
- Anything the assistant said about itself (only extract what the USER revealed)

For each extracted memory, classify it as:
- "fact": A concrete piece of information about the user (name, preferences, occupation, relationships, etc.)
- "moment": An emotionally significant exchange or personal revelation

Rate importance from 1-10:
- 1-3: Minor preferences or casual mentions
- 4-6: Meaningful personal details
- 7-9: Core identity, deep emotions, significant life events
- 10: Critical, life-defining information
${existingFactsList}

---
USER: ${user_message}

${agent_name?.toUpperCase() || 'ASSISTANT'}: ${assistant_response}
---

Respond with a JSON array ONLY. No explanation, no markdown fencing. If nothing worth remembering, respond with [].

Example format:
[{"type":"fact","content":"User's name is Alex","importance":8},{"type":"moment","content":"User shared feeling overwhelmed with work deadlines","importance":6}]`;

        // ─── Call LLM for extraction ────────────────────────────────────
        const completionUrl = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

        const response = await fetch(completionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: 'system', content: 'You are a precise memory extraction system. Output ONLY valid JSON arrays. Never output markdown, explanations, or anything other than a JSON array.' },
                    { role: 'user', content: extractionPrompt },
                ],
                temperature: 0.1,
                max_tokens: 512,
            }),
        });

        if (!response.ok) {
            console.error('[companion-memory/extract] LLM call failed:', response.status);
            return NextResponse.json({ extracted: [], error: 'LLM extraction failed' }, { status: 200 });
        }

        const result = await response.json();
        const rawContent = result.choices?.[0]?.message?.content || '[]';

        // Parse the JSON response
        let extracted: Array<{ type: string; content: string; importance: number }> = [];
        try {
            // Strip markdown fencing if present
            const cleaned = rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
                extracted = parsed.filter(
                    (m: any) => m && m.content && (m.type === 'fact' || m.type === 'moment')
                );
            }
        } catch (parseErr) {
            console.warn('[companion-memory/extract] Failed to parse LLM response:', rawContent.slice(0, 300));
        }

        // ─── Save extracted memories ────────────────────────────────────
        if (extracted.length > 0) {
            const toInsert = extracted.map(m => ({
                user_id: userId,
                agent_id,
                memory_type: m.type,
                content: m.content.trim(),
                importance: Math.min(10, Math.max(1, m.importance || 5)),
                source_conversation_id: conversation_id || null,
            }));

            // Dedup against existing
            const existingSet = new Set(existing_facts.map((f: string) => f.toLowerCase().trim()));
            const deduped = toInsert.filter(m => !existingSet.has(m.content.toLowerCase().trim()));

            if (deduped.length > 0) {
                const { error: insertErr } = await db
                    .from('companion_memories')
                    .insert(deduped);

                if (insertErr) {
                    console.error('[companion-memory/extract] Insert failed:', insertErr.message);
                } else {
                    console.log(`[companion-memory/extract] Saved ${deduped.length} new memories for ${agent_id}`);
                }
            }
        }

        // ─── Generate conversation summary if conversation is long enough ──
        if (conversation_length > 0 && conversation_length % 10 === 0 && conversation_id) {
            // Every 10 messages, generate a conversation summary
            try {
                const summaryPrompt = `Summarize this conversation exchange in 1-2 sentences for future reference. Focus on what topics were discussed and any key decisions or emotional moments.\n\nUSER: ${user_message}\n\n${agent_name?.toUpperCase() || 'ASSISTANT'}: ${assistant_response.slice(0, 500)}`;

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
                            { role: 'user', content: summaryPrompt },
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
                            agent_id,
                            memory_type: 'summary',
                            content: summary,
                            importance: 5,
                            source_conversation_id: conversation_id,
                        });
                        console.log(`[companion-memory/extract] Saved conversation summary for ${agent_id}`);
                    }
                }
            } catch (sumErr) {
                console.warn('[companion-memory/extract] Summary generation failed:', sumErr);
            }
        }

        return NextResponse.json({
            extracted: extracted.length,
            memories: extracted,
        });
    } catch (error: unknown) {
        console.error('[companion-memory/extract]', error);
        return NextResponse.json({ extracted: 0, error: 'Extraction failed' }, { status: 200 });
    }
}
