import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/companion-profiles?agent_id={agentId}
 * Fetches the companion profile for a specific agent.
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

        const { data, error } = await db
            .from('companion_profiles')
            .select('*')
            .eq('user_id', userId)
            .eq('agent_id', agentId)
            .maybeSingle();

        if (error) throw new Error(error.message);

        return NextResponse.json({ profile: data || null });
    } catch (error: unknown) {
        console.error('[companion-profiles GET]', error);
        return NextResponse.json({ error: 'Failed to fetch companion profile' }, { status: 500 });
    }
}

/**
 * POST /api/companion-profiles
 * Upserts a companion profile.
 * Body: { agent_id, sections, raw_markdown }
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { agent_id, sections, raw_markdown } = body;

        if (!agent_id) {
            return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
        }

        // Check if profile already exists
        const { data: existing } = await db
            .from('companion_profiles')
            .select('id')
            .eq('user_id', userId)
            .eq('agent_id', agent_id)
            .maybeSingle();

        let result;

        if (existing) {
            // Update existing
            const { data, error } = await db
                .from('companion_profiles')
                .update({
                    sections: sections || {},
                    raw_markdown: raw_markdown || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw new Error(error.message);
            result = data;
        } else {
            // Insert new
            const id = crypto.randomUUID();
            const { data, error } = await db
                .from('companion_profiles')
                .insert({
                    id,
                    user_id: userId,
                    agent_id,
                    sections: sections || {},
                    raw_markdown: raw_markdown || null,
                })
                .select()
                .single();

            if (error) throw new Error(error.message);
            result = data;
        }

        return NextResponse.json({ profile: result });
    } catch (error: unknown) {
        console.error('[companion-profiles POST]', error);
        return NextResponse.json({ error: 'Failed to save companion profile' }, { status: 500 });
    }
}
