import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/pentagram-saves
 * List all game saves for the user.
 */
export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await db
        .from('pentagram_saves')
        .select('id, save_name, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
}

/**
 * POST /api/pentagram-saves
 * Create or overwrite a save.
 * Body: { save_name, save_data, save_id? }
 * save_data includes: gameState, currentSceneId, history, chatHistories, worldMemories, personalMemories
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { save_name, save_data, save_id } = body;

    if (!save_name || !save_data) {
        return NextResponse.json({ error: 'save_name and save_data required' }, { status: 400 });
    }

    if (save_id) {
        // Overwrite existing save
        const { error } = await db
            .from('pentagram_saves')
            .update({ save_name, save_data, updated_at: new Date().toISOString() })
            .eq('id', save_id)
            .eq('user_id', userId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, id: save_id });
    }

    // Create new save
    const { data, error } = await db
        .from('pentagram_saves')
        .insert({ user_id: userId, save_name, save_data })
        .select('id')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data.id });
}

/**
 * PUT /api/pentagram-saves
 * Load a save — returns the full save_data for the client to apply.
 * Body: { save_id }
 */
export async function PUT(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { save_id } = body;

    if (!save_id) {
        return NextResponse.json({ error: 'save_id required' }, { status: 400 });
    }

    const { data, error } = await db
        .from('pentagram_saves')
        .select('*')
        .eq('id', save_id)
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: 'Save not found' }, { status: 404 });
    }

    return NextResponse.json(data);
}

/**
 * DELETE /api/pentagram-saves?id=xxx
 * Delete a save.
 */
export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get('id');

    if (!saveId) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { error } = await db
        .from('pentagram_saves')
        .delete()
        .eq('id', saveId)
        .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
