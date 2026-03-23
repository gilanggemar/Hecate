import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/projects/[id]
 * Get project details including files.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;

        const { data, error } = await db
            .from('projects')
            .select('*, project_files(*)')
            .eq('user_id', userId)
            .eq('id', id)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json({ project: data });
    } catch (error: unknown) {
        console.error('[projects/[id] GET]', error);
        return NextResponse.json({ error: 'Failed to get project' }, { status: 500 });
    }
}

/**
 * PATCH /api/projects/[id]
 * Update project fields.
 * Body: { name?, description?, custom_instructions?, agent_id? }
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const { name, description, custom_instructions, agent_id } = body;

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (custom_instructions !== undefined) updates.custom_instructions = custom_instructions;
        if (agent_id !== undefined) updates.agent_id = agent_id;

        const { data, error } = await db
            .from('projects')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ project: data });
    } catch (error: unknown) {
        console.error('[projects/[id] PATCH]', error);
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project and all its files (CASCADE).
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;

        const { error } = await db
            .from('projects')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ deleted: true });
    } catch (error: unknown) {
        console.error('[projects/[id] DELETE]', error);
        return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }
}
