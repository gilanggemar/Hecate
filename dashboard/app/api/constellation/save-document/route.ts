import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { fileName, fileType, content, sizeBytes } = body;

        if (!fileName || !content) {
            return NextResponse.json({ error: 'File name and content are required' }, { status: 400 });
        }

        const newDoc = {
            id: uuidv4(),
            file_name: fileName,
            file_type: fileType || 'unknown',
            content,
            size_bytes: sizeBytes || 0,
            indexed: false,
        };

        const { error } = await db.from('knowledge_documents').insert(newDoc);
        if (error) throw new Error(error.message);

        return NextResponse.json({ success: true, document: newDoc });
    } catch (error: any) {
        console.error('[constellation/save-document POST]', error);
        return NextResponse.json({ error: error.message || 'Failed to save document' }, { status: 500 });
    }
}
