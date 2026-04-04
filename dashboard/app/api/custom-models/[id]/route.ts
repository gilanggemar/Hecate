import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// DELETE /api/custom-models/[id] — delete a custom model
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    try {
        const { error } = await db
            .from('custom_models')
            .delete()
            .eq('user_id', userId)
            .eq('id', id);

        if (error) throw new Error(error.message);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Failed to delete custom model:', error);
        return NextResponse.json({ error: 'Failed to delete custom model' }, { status: 500 });
    }
}
