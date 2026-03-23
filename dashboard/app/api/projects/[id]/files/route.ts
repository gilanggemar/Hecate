import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/projects/[id]/files
 * List files for a project.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;

        // Verify project belongs to user
        const { data: project, error: projErr } = await db
            .from('projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (projErr || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { data: files, error } = await db
            .from('project_files')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return NextResponse.json({ files: files || [] });
    } catch (error: unknown) {
        console.error('[projects/[id]/files GET]', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}

/**
 * POST /api/projects/[id]/files
 * Upload a file to a project. Stores in Supabase Storage and extracts text for context.
 * Body: { name, type, data (base64 data URL) }
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const { name, type, data } = body;

        if (!data || !name) {
            return NextResponse.json({ error: 'Missing name or data' }, { status: 400 });
        }

        // Verify project belongs to user
        const { data: project, error: projErr } = await db
            .from('projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (projErr || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Strip data URL prefix
        const base64Match = data.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) {
            return NextResponse.json({ error: 'Invalid data URL format' }, { status: 400 });
        }
        const base64Data = base64Match[1];
        const buffer = Buffer.from(base64Data, 'base64');

        // Upload to Supabase Storage
        const timestamp = Date.now();
        const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `projects/${id}/${timestamp}-${safeName}`;

        const { error: uploadError } = await db.storage
            .from('chat-attachments')
            .upload(storagePath, buffer, {
                contentType: type || 'application/octet-stream',
                upsert: false,
            });

        if (uploadError) {
            console.error('[project files upload]', uploadError);
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        const { data: urlData } = db.storage
            .from('chat-attachments')
            .getPublicUrl(storagePath);

        // Extract text content for context injection (text-based files only)
        let contentText: string | null = null;
        const textTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'text/html'];
        const textExtensions = ['.txt', '.md', '.csv', '.json', '.html', '.xml', '.yaml', '.yml', '.toml', '.ini', '.log'];
        const isTextFile = textTypes.some(t => (type || '').includes(t)) ||
            textExtensions.some(ext => name.toLowerCase().endsWith(ext));

        if (isTextFile) {
            contentText = buffer.toString('utf-8');
            // Limit to 50KB of text content
            if (contentText.length > 50000) {
                contentText = contentText.substring(0, 50000) + '\n\n[... content truncated at 50KB ...]';
            }
        }

        // Save file record to DB
        const { data: fileRecord, error: fileErr } = await db
            .from('project_files')
            .insert({
                project_id: id,
                user_id: userId,
                file_name: name,
                file_type: type || 'application/octet-stream',
                file_url: urlData.publicUrl,
                content_text: contentText,
                file_size: buffer.length,
            })
            .select()
            .single();

        if (fileErr) throw new Error(fileErr.message);

        return NextResponse.json({ file: fileRecord }, { status: 201 });
    } catch (error: unknown) {
        console.error('[projects/[id]/files POST]', error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}

/**
 * DELETE /api/projects/[id]/files
 * Remove a specific file. Body: { file_id }
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await params;
        const body = await request.json();
        const { file_id } = body;

        if (!file_id) {
            return NextResponse.json({ error: 'file_id is required' }, { status: 400 });
        }

        const { error } = await db
            .from('project_files')
            .delete()
            .eq('id', file_id)
            .eq('project_id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ deleted: true });
    } catch (error: unknown) {
        console.error('[projects/[id]/files DELETE]', error);
        return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }
}
