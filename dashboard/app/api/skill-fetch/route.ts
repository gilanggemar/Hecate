import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/skill-fetch
 * Server-side proxy to fetch skill content from external URLs (avoids CORS).
 * Handles GitHub repo URLs, skill.sh links, and raw URLs.
 */
export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
        }

        // Validate URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        // Fetch the content
        const response = await fetch(url, {
            headers: {
                'Accept': 'text/plain, text/markdown, application/octet-stream, */*',
                'User-Agent': 'NERV-OS-Dashboard/1.0',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch: ${response.status} ${response.statusText}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type') || '';
        let content = '';
        let description = '';

        if (contentType.includes('application/zip') || contentType.includes('application/octet-stream')) {
            // For zip files, return a note — actual extraction would need more logic
            content = await response.text();
            description = 'Binary/archive skill content';
        } else {
            content = await response.text();
        }

        // Try to extract description from first paragraph or YAML frontmatter
        const lines = content.split('\n');
        const descLine = lines.find(l =>
            l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('```')
        );
        description = descLine?.trim().slice(0, 200) || 'No description available';

        // Detect source type
        let source: 'github' | 'skill.sh' | 'manual' = 'manual';
        if (parsedUrl.hostname.includes('github') || parsedUrl.hostname.includes('githubusercontent')) {
            source = 'github';
        } else if (parsedUrl.hostname.includes('skill.sh')) {
            source = 'skill.sh';
        }

        return NextResponse.json({
            content,
            description,
            source,
            url: url,
        });
    } catch (err: any) {
        console.error('[skill-fetch] Error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
