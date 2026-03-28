import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
    try {
        const { data, error } = await supabase.storage.from('pentagram-assets').list('', {
            limit: 100,
            sortBy: { column: 'created_at', order: 'desc' }
        });
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Return public URLs for each file
        const assets = data
            .filter(file => file.name && file.name !== '.emptyFolderPlaceholder')
            .map(file => {
                const { data: { publicUrl } } = supabase.storage.from('pentagram-assets').getPublicUrl(file.name);
                return {
                    name: file.name,
                    url: publicUrl,
                    created_at: file.created_at
                };
            });
            
        return NextResponse.json(assets);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fileName = searchParams.get('file');

        if (!fileName) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        // Storage removal
        const { error: removeError } = await supabase.storage.from('pentagram-assets').remove([fileName]);
        if (removeError) throw removeError;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
