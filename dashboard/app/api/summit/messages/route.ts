import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/summit/messages?session_id={sessionId}
 * Lists messages for a summit session.
 */
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }

        // Verify session belongs to user
        const { data: session } = await db
            .from('summit_sessions')
            .select('id')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .single();

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const { data, error } = await db
            .from('summit_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(error.message);
        return NextResponse.json({ messages: data || [] });
    } catch (error: unknown) {
        console.error('[summit/messages GET]', error);
        return NextResponse.json({ error: 'Failed to list messages' }, { status: 500 });
    }
}

/**
 * POST /api/summit/messages
 * Saves one or more messages to a summit session.
 * Body: { session_id: string, messages: Array<{ role, agent_id?, content, round_number?, mode_indicators?, attachments?, tool_calls? }> }
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { session_id, messages } = body;

        if (!session_id || !messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'session_id and messages[] are required' }, { status: 400 });
        }

        // Verify session belongs to user
        const { data: session } = await db
            .from('summit_sessions')
            .select('id')
            .eq('id', session_id)
            .eq('user_id', userId)
            .single();

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const rows = messages.map((m: any) => ({
            id: m.id || crypto.randomUUID(),
            session_id,
            role: m.role,
            agent_id: m.agent_id || m.agentId || null,
            content: m.content || '',
            round_number: m.round_number || m.roundNumber || null,
            mode_indicators: m.mode_indicators || m.modeIndicators || null,
            attachments: m.attachments || null,
            tool_calls: m.tool_calls || null,
        }));

        const { data, error } = await db
            .from('summit_messages')
            .upsert(rows, { onConflict: 'id' })
            .select();

        if (error) throw new Error(error.message);

        // Update session message count
        await db
            .from('summit_sessions')
            .update({
                message_count: rows.length,
                updated_at: new Date().toISOString(),
            })
            .eq('id', session_id);

        return NextResponse.json({ saved: data?.length || 0 }, { status: 201 });
    } catch (error: unknown) {
        console.error('[summit/messages POST]', error);
        return NextResponse.json({ error: 'Failed to save messages' }, { status: 500 });
    }
}
