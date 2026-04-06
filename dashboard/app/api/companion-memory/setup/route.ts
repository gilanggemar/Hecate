import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/companion-memory/setup
 * Creates the companion_memories table if it doesn't exist.
 * Run this once to initialize the schema.
 */
export async function POST() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Create the table using raw SQL via Supabase's rpc or direct query
        const { error } = await db.rpc('exec_sql', {
            query: `
                CREATE TABLE IF NOT EXISTS companion_memories (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    agent_id TEXT NOT NULL,
                    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'summary', 'moment')),
                    content TEXT NOT NULL,
                    importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
                    source_conversation_id UUID,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                );

                CREATE INDEX IF NOT EXISTS idx_companion_memories_agent
                    ON companion_memories(user_id, agent_id, memory_type);

                CREATE INDEX IF NOT EXISTS idx_companion_memories_importance
                    ON companion_memories(user_id, agent_id, importance DESC);

                ALTER TABLE companion_memories ENABLE ROW LEVEL SECURITY;

                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_policies WHERE tablename = 'companion_memories' AND policyname = 'companion_memories_user_policy'
                    ) THEN
                        CREATE POLICY companion_memories_user_policy ON companion_memories
                            FOR ALL USING (auth.uid() = user_id);
                    END IF;
                END $$;
            `
        });

        if (error) {
            // If RPC doesn't exist, try creating table via individual inserts as a test
            // The table might need to be created directly in Supabase Dashboard
            console.error('[companion-memory/setup] RPC failed:', error.message);
            return NextResponse.json({
                error: 'RPC failed. Please create the table manually in Supabase Dashboard.',
                sql: `
CREATE TABLE IF NOT EXISTS companion_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    agent_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'summary', 'moment')),
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 5,
    source_conversation_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_memories_agent ON companion_memories(user_id, agent_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_companion_memories_importance ON companion_memories(user_id, agent_id, importance DESC);
                `.trim(),
            }, { status: 200 });
        }

        return NextResponse.json({ success: true, message: 'companion_memories table created' });
    } catch (error: unknown) {
        console.error('[companion-memory/setup]', error);
        return NextResponse.json({ error: 'Failed to create table' }, { status: 500 });
    }
}
