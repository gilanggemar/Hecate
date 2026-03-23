import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// GET /api/knowledge-documents?page=1&pageSize=20&search=...
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
        const search = searchParams.get('search') || '';

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        // Select only columns we need for display
        let query = db
            .from('knowledge_documents')
            .select('id, file_name, file_type, content, text, source, source_type, author, published_at, credibility_tier', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (search) {
            query = query.or(`file_name.ilike.%${search}%,content.ilike.%${search}%,author.ilike.%${search}%,source.ilike.%${search}%`);
        }

        const { data, count, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({
            data: data || [],
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        });
    } catch (error: unknown) {
        console.error('GET /api/knowledge-documents failed:', error);
        return NextResponse.json({ error: 'Failed to fetch knowledge documents' }, { status: 500 });
    }
}

// POST /api/knowledge-documents — add new knowledge document
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { file_name, file_type, content, text, source, source_type, author, credibility_tier } = body;

        if (!file_name) {
            return NextResponse.json({ error: 'file_name is required' }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const { error } = await db.from('knowledge_documents').insert({
            id,
            user_id: userId,
            file_name,
            file_type: file_type || null,
            content: content || null,
            text: text || null,
            source: source || null,
            source_type: source_type || null,
            author: author || null,
            credibility_tier: credibility_tier || null,
            size_bytes: content ? new TextEncoder().encode(content).length : 0,
            indexed: false,
        });
        if (error) throw new Error(error.message);
        return NextResponse.json({ id }, { status: 201 });
    } catch (error: unknown) {
        console.error('POST /api/knowledge-documents failed:', error);
        return NextResponse.json({ error: 'Failed to add knowledge document' }, { status: 500 });
    }
}

// PUT /api/knowledge-documents — update a knowledge document
export async function PUT(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, ...fields } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const allowed = ['file_name', 'file_type', 'content', 'text', 'source', 'source_type', 'author', 'credibility_tier'];
        const updates: Record<string, any> = {};
        for (const key of allowed) {
            if (key in fields) updates[key] = fields[key];
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const { error } = await db.from('knowledge_documents').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('PUT /api/knowledge-documents failed:', error);
        return NextResponse.json({ error: 'Failed to update knowledge document' }, { status: 500 });
    }
}

// DELETE /api/knowledge-documents?id=X
export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }
        const { error } = await db.from('knowledge_documents').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('DELETE /api/knowledge-documents failed:', error);
        return NextResponse.json({ error: 'Failed to delete knowledge document' }, { status: 500 });
    }
}
