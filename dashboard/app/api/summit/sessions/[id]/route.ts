import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/summit/sessions/[id]
 * Gets a specific summit session with its messages.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    try {
        const { data: session, error: sessionError } = await db
            .from('summit_sessions')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const { data: messages, error: msgError } = await db
            .from('summit_messages')
            .select('*')
            .eq('session_id', id)
            .order('created_at', { ascending: true });

        if (msgError) throw new Error(msgError.message);

        return NextResponse.json({ session, messages: messages || [] });
    } catch (error: unknown) {
        console.error('[summit/sessions/[id] GET]', error);
        return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
    }
}

/**
 * PATCH /api/summit/sessions/[id]
 * Updates a summit session (title, topic, status, config, deliberation_round).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    try {
        const body = await request.json();
        const allowedFields = ['title', 'topic', 'status', 'config', 'deliberation_round', 'message_count', 'participants'];
        const updates: Record<string, any> = { updated_at: new Date().toISOString() };

        for (const field of allowedFields) {
            if (body[field] !== undefined) updates[field] = body[field];
        }

        const { data, error } = await db
            .from('summit_sessions')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ session: data });
    } catch (error: unknown) {
        console.error('[summit/sessions/[id] PATCH]', error);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }
}

/**
 * DELETE /api/summit/sessions/[id]
 * Deletes a summit session and all its messages.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    try {
        const { error } = await db
            .from('summit_sessions')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[summit/sessions/[id] DELETE]', error);
        return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }
}
