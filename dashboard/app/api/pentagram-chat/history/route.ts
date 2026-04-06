import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/pentagram-chat/history?agent_id=xxx
 * Fetch chat history for a specific agent in the pentagram game.
 */
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (!agentId) {
        return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
    }

    const { data, error } = await db
        .from('pentagram_chat_history')
        .select('*')
        .eq('user_id', userId)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: true })
        .limit(200);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}

/**
 * DELETE /api/pentagram-chat/history?agent_id=xxx
 * Delete all chat history for a specific agent (memories persist).
 */
export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');

    if (!agentId) {
        return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
    }

    const { error } = await db
        .from('pentagram_chat_history')
        .delete()
        .eq('user_id', userId)
        .eq('agent_id', agentId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
