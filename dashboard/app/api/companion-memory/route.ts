import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/companion-memory?agent_id=X
 * Fetches memories for a specific agent, ordered by importance and recency.
 * Returns up to 30 memories (facts + moments) + 3 most recent summaries.
 */
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agent_id');

        if (!agentId) {
            return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
        }

        // Fetch facts and moments (up to 30, ordered by importance then recency)
        const { data: memories, error: memError } = await db
            .from('companion_memories')
            .select('*')
            .eq('user_id', userId)
            .eq('agent_id', agentId)
            .in('memory_type', ['fact', 'moment'])
            .order('importance', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(30);

        if (memError) throw new Error(memError.message);

        // Fetch recent summaries (up to 5)
        const { data: summaries, error: sumError } = await db
            .from('companion_memories')
            .select('*')
            .eq('user_id', userId)
            .eq('agent_id', agentId)
            .eq('memory_type', 'summary')
            .order('created_at', { ascending: false })
            .limit(5);

        if (sumError) throw new Error(sumError.message);

        return NextResponse.json({
            memories: memories || [],
            summaries: summaries || [],
        });
    } catch (error: unknown) {
        console.error('[companion-memory GET]', error);
        return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
    }
}

/**
 * POST /api/companion-memory
 * Add one or more memory entries.
 * Body: { agent_id, memories: [{ memory_type, content, importance?, source_conversation_id? }] }
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { agent_id, memories } = body;

        if (!agent_id || !memories || !Array.isArray(memories) || memories.length === 0) {
            return NextResponse.json(
                { error: 'agent_id and memories array are required' },
                { status: 400 }
            );
        }

        // Fetch existing facts for deduplication
        const { data: existingFacts } = await db
            .from('companion_memories')
            .select('content')
            .eq('user_id', userId)
            .eq('agent_id', agent_id)
            .eq('memory_type', 'fact');

        const existingSet = new Set(
            (existingFacts || []).map(f => f.content.toLowerCase().trim())
        );

        // Filter out duplicates and prepare inserts
        const toInsert = memories
            .filter((m: any) => {
                if (!m.content || !m.memory_type) return false;
                // Skip exact duplicate facts
                if (m.memory_type === 'fact' && existingSet.has(m.content.toLowerCase().trim())) {
                    return false;
                }
                return true;
            })
            .map((m: any) => ({
                user_id: userId,
                agent_id,
                memory_type: m.memory_type,
                content: m.content.trim(),
                importance: Math.min(10, Math.max(1, m.importance || 5)),
                source_conversation_id: m.source_conversation_id || null,
            }));

        if (toInsert.length === 0) {
            return NextResponse.json({ inserted: 0, message: 'No new memories to add (all duplicates)' });
        }

        const { data, error } = await db
            .from('companion_memories')
            .insert(toInsert)
            .select();

        if (error) throw new Error(error.message);

        return NextResponse.json({ inserted: data?.length || 0, memories: data });
    } catch (error: unknown) {
        console.error('[companion-memory POST]', error);
        return NextResponse.json({ error: 'Failed to save memories' }, { status: 500 });
    }
}

/**
 * DELETE /api/companion-memory?id=X
 * Delete a specific memory entry.
 */
export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const memoryId = searchParams.get('id');

        if (!memoryId) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { error } = await db
            .from('companion_memories')
            .delete()
            .eq('id', memoryId)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);

        return NextResponse.json({ deleted: true });
    } catch (error: unknown) {
        console.error('[companion-memory DELETE]', error);
        return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
    }
}
