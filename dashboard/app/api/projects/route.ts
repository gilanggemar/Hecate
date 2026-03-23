import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/projects?agent_id={agentId}
 * List user's projects, optionally filtered by agent.
 */
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agent_id');

        let query = db
            .from('projects')
            .select('*, project_files(id, file_name, file_type, file_size)')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (agentId) {
            query = query.or(`agent_id.eq.${agentId},agent_id.is.null`);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({ projects: data || [] });
    } catch (error: unknown) {
        console.error('[projects GET]', error);
        return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
    }
}

/**
 * POST /api/projects
 * Create a new project.
 * Body: { name, description?, custom_instructions?, agent_id? }
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { name, description, custom_instructions, agent_id } = body;

        if (!name) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const { data, error } = await db
            .from('projects')
            .insert({
                user_id: userId,
                name,
                description: description || null,
                custom_instructions: custom_instructions || null,
                agent_id: agent_id || null,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ project: data }, { status: 201 });
    } catch (error: unknown) {
        console.error('[projects POST]', error);
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }
}
