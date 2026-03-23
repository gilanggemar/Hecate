import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/summit/sessions
 * Lists all summit sessions for the authenticated user.
 */
export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await db
            .from('summit_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw new Error(error.message);
        return NextResponse.json({ sessions: data || [] });
    } catch (error: unknown) {
        console.error('[summit/sessions GET]', error);
        return NextResponse.json({ error: 'Failed to list summit sessions' }, { status: 500 });
    }
}

/**
 * POST /api/summit/sessions
 * Creates a new summit session.
 * Body: { title?, topic?, participants: string[], config?: object }
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { title, topic, participants, config } = body;

        const id = crypto.randomUUID();
        const { data, error } = await db
            .from('summit_sessions')
            .insert({
                id,
                user_id: userId,
                title: title || `Summit ${new Date().toLocaleDateString()}`,
                topic: topic || null,
                participants: participants || [],
                config: config || {},
                status: 'active',
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ session: data }, { status: 201 });
    } catch (error: unknown) {
        console.error('[summit/sessions POST]', error);
        return NextResponse.json({ error: 'Failed to create summit session' }, { status: 500 });
    }
}
