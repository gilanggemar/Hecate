import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client to bypass RLS for uploads if needed, 
// though standard client works if policies are configured.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const type = formData.get("type") as string | null;

        if (!file || !type) {
            return NextResponse.json({ error: "File and type are required" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `${type}_${Date.now()}.${ext}`;
        
        // This assumes a storage bucket named 'pentagram-assets' exists
        let { data, error } = await supabase.storage
            .from("pentagram-assets")
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: false
            });

        if (error) {
            // Attempt to create the public bucket if it doesn't exist
            await supabase.storage.createBucket('pentagram-assets', { public: true });
            
            // Retry upload
            const retry = await supabase.storage
                .from("pentagram-assets")
                .upload(fileName, buffer, {
                    contentType: file.type,
                    upsert: false
                });
                
            error = retry.error;
            data = retry.data;

            if (error) {
                console.error("Supabase storage error:", error);
                return NextResponse.json({ error: "Storage upload failed", details: error }, { status: 500 });
            }
        }

        const { data: { publicUrl } } = supabase.storage
            .from("pentagram-assets")
            .getPublicUrl(fileName);

        // Record it in the DB
        await supabase.from("pentagram_assets").insert({
            asset_type: type,
            file_name: file.name,
            data_url: publicUrl,
            is_active: true
        });

        return NextResponse.json({ url: publicUrl });

    } catch (e: any) {
        console.error("Upload error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
