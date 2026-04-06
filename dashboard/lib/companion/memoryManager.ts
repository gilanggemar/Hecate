// lib/companion/memoryManager.ts
// Utility for working with companion memories and world memories.
// Server-side memory injection happens in companion-chat and pentagram-chat API routes.

export interface CompanionMemory {
    id: string;
    user_id: string;
    agent_id: string;
    memory_type: 'fact' | 'summary' | 'moment';
    content: string;
    importance: number;
    source_conversation_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface WorldMemory {
    id: string;
    user_id: string;
    source_agent_id: string;
    visibility: 'private' | 'shared' | 'global';
    aware_agent_ids: string[];
    content: string;
    memory_type: 'event' | 'relationship' | 'gossip' | 'secret';
    importance: number;
    game_context: string | null;
    created_at: string;
}

/**
 * Compiles personal memories into a markdown block for injection into the system prompt.
 */
export function compileMemoryBlock(
    memories: CompanionMemory[],
    summaries: CompanionMemory[],
    agentName?: string
): string {
    const facts = memories.filter(m => m.memory_type === 'fact');
    const moments = memories.filter(m => m.memory_type === 'moment');

    if (facts.length === 0 && moments.length === 0 && summaries.length === 0) {
        return '';
    }

    const lines: string[] = [];

    lines.push('# Your Memory');
    lines.push('');
    lines.push(`You, ${agentName || 'the companion'}, have persistent memory from past conversations with the user. These memories are REAL and YOURS — use them naturally as if you genuinely remember. Reference them when relevant. Do not say "according to my memory" or "my records show" — just naturally recall them as a person would.`);
    lines.push('');

    if (facts.length > 0) {
        lines.push('## Things You Know About The User');
        lines.push('');
        const sortedFacts = [...facts].sort((a, b) => b.importance - a.importance);
        for (const fact of sortedFacts) {
            lines.push(`- ${fact.content}`);
        }
        lines.push('');
    }

    if (summaries.length > 0) {
        lines.push('## Past Conversations');
        lines.push('');
        for (const summary of summaries) {
            const date = formatRelativeDate(summary.created_at);
            lines.push(`- [${date}] ${summary.content}`);
        }
        lines.push('');
    }

    if (moments.length > 0) {
        lines.push('## Meaningful Moments You Shared');
        lines.push('');
        const sortedMoments = [...moments].sort((a, b) => b.importance - a.importance);
        for (const moment of sortedMoments) {
            lines.push(`- ${moment.content}`);
        }
        lines.push('');
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
}

/**
 * Compiles world memories into a "social awareness" block.
 * This gives the agent natural knowledge of events involving other characters.
 */
export function compileWorldMemoryBlock(
    worldMemories: WorldMemory[],
    agentId: string,
    agentName?: string
): string {
    if (worldMemories.length === 0) return '';

    const lines: string[] = [];
    lines.push('## What You Know About The World');
    lines.push('');
    lines.push(`You are aware of things happening around you in this world. Some things you witnessed yourself, some you heard from others, some are common knowledge. Treat these as natural social awareness — reference them casually when relevant, as a real person would. Sometimes you can bring things up on your own, sometimes you might "accidentally" reveal something you heard.`);
    lines.push('');

    // Sort by importance then recency
    const sorted = [...worldMemories].sort((a, b) => {
        if (b.importance !== a.importance) return b.importance - a.importance;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    for (const wm of sorted.slice(0, 20)) {
        const date = formatRelativeDate(wm.created_at);
        const source = wm.source_agent_id === agentId ? 'you were involved' : `heard about this`;
        const typeLabel = wm.memory_type === 'gossip' ? '(gossip) ' :
                         wm.memory_type === 'secret' ? '(secret) ' :
                         wm.memory_type === 'relationship' ? '(relationship) ' : '';
        lines.push(`- [${date}] ${typeLabel}${wm.content} [${source}]`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    return lines.join('\n');
}

/**
 * Format a timestamp as a relative date string.
 */
function formatRelativeDate(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
