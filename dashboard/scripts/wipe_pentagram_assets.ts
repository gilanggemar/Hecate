import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function wipe() {
    console.log("Fetching all files in pentagram-assets...");
    const { data: files, error: listError } = await supabase.storage.from('pentagram-assets').list();
    
    if (listError) {
        console.error("List error:", listError);
        return;
    }
    
    if (!files || files.length === 0) {
        console.log("No files to delete.");
        return;
    }
    
    const fileNames = files.map(f => f.name).filter(n => n !== '.emptyFolderPlaceholder');
    console.log(`Found ${fileNames.length} files. Deleting...`);
    
    if (fileNames.length > 0) {
        const { error: removeError } = await supabase.storage.from('pentagram-assets').remove(fileNames);
        if (removeError) {
            console.error("Remove storage error:", removeError);
        } else {
            console.log("Storage bucket wiped!");
        }
        
        // Also wipe the DB table records
        const { error: dbError } = await supabase.from('pentagram_assets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (dbError) {
            console.error("DB delete error:", dbError);
        } else {
            console.log("DB table wiped!");
        }
    }
}

wipe().catch(console.error);
