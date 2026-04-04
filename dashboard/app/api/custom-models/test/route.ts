import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';

// POST /api/custom-models/test — test connection to a custom model provider
// This does NOT require a saved model — it tests with the provided credentials directly
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { providerType, baseUrl, apiKey, modelId } = body;

        if (!baseUrl && !providerType) {
            return NextResponse.json(
                { success: false, error: 'baseUrl or providerType is required' },
                { status: 400 }
            );
        }

        // Build auth headers
        const headers: Record<string, string> = {};
        if (apiKey) {
            if (providerType === 'anthropic') {
                headers['x-api-key'] = apiKey;
                headers['anthropic-version'] = '2023-06-01';
            } else {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
        }

        // ── Strategy 1: Try a minimal chat completion (1 token) — fastest ──
        // When model ID + API key are available, this is the most reliable and fastest test.
        const completionsEndpoint = resolveCompletionsEndpoint(providerType, baseUrl);
        if (completionsEndpoint && modelId && apiKey) {
            const result = await tryCompletionPing(completionsEndpoint, headers, modelId);
            if (result.success) return NextResponse.json(result);
            // If completion fails with auth error, return that immediately
            if (result.error?.includes('Authentication') || result.error?.includes('401') || result.error?.includes('403')) {
                return NextResponse.json(result);
            }
            // Otherwise fall through to /models endpoint as a backup
        }

        // ── Strategy 2: Try /models listing endpoint ────────────────────
        const modelsEndpoint = resolveModelsEndpoint(providerType, baseUrl);
        if (modelsEndpoint) {
            const result = await tryModelsEndpoint(modelsEndpoint, headers, modelId);
            if (result.success) return NextResponse.json(result);

            if (!result.is404) {
                return NextResponse.json(result);
            }
        }

        // ── Neither worked ──────────────────────────────────────────────
        return NextResponse.json({
            success: false,
            error: 'Could not verify connection. Ensure the base URL and API key are correct.',
        });

    } catch (error: unknown) {
        console.error('Failed to test custom model:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Test failed',
        });
    }
}

// ─── Strategy 1: GET /models ────────────────────────────────────────────────

async function tryModelsEndpoint(
    endpoint: string,
    headers: Record<string, string>,
    modelId?: string
): Promise<{ success: boolean; error?: string; modelFound?: boolean; modelsAvailable?: number; is404?: boolean }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const res = await fetch(endpoint, {
            method: 'GET',
            headers: { ...headers },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            const errorText = await res.text().catch(() => '');
            return {
                success: false,
                is404: res.status === 404,
                error: `HTTP ${res.status}: ${res.statusText}${errorText ? ` — ${errorText.slice(0, 200)}` : ''}`,
            };
        }

        const data = await res.json().catch(() => null);
        let modelFound = false;
        let modelList: string[] = [];

        if (data) {
            if (data.data && Array.isArray(data.data)) {
                modelList = data.data.map((m: any) => m.id || m.name || '').filter(Boolean);
            } else if (Array.isArray(data)) {
                modelList = data.map((m: any) => m.id || m.name || m.model || '').filter(Boolean);
            } else if (data.models && Array.isArray(data.models)) {
                modelList = data.models.map((m: any) => m.name || m.displayName || '').filter(Boolean);
            }

            if (modelId && modelList.length > 0) {
                modelFound = modelList.some(id =>
                    id.toLowerCase().includes(modelId.toLowerCase()) ||
                    modelId.toLowerCase().includes(id.toLowerCase())
                );
            }
        }

        return {
            success: true,
            modelFound: modelId ? modelFound : undefined,
            modelsAvailable: modelList.length,
        };
    } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') {
            return { success: false, error: 'Connection timed out (30s) — the provider may be slow or unreachable' };
        }
        return { success: false, error: fetchErr.message || 'Connection failed' };
    }
}

// ─── Strategy 2: POST /chat/completions with max_tokens=1 ───────────────────

async function tryCompletionPing(
    endpoint: string,
    headers: Record<string, string>,
    modelId: string
): Promise<{ success: boolean; error?: string; modelFound?: boolean }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1,
                stream: false,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            const errorText = await res.text().catch(() => '');

            // 401/403 = auth issue, 404 = model not found — give specific errors
            if (res.status === 401 || res.status === 403) {
                return { success: false, error: 'Authentication failed — check your API key.' };
            }
            if (res.status === 404) {
                return { success: false, error: `Model "${modelId}" not found on this provider.`, modelFound: false };
            }

            return {
                success: false,
                error: `HTTP ${res.status}: ${res.statusText}${errorText ? ` — ${errorText.slice(0, 200)}` : ''}`,
            };
        }

        // If we get a 200, the model exists and credentials work
        return { success: true, modelFound: true };
    } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') {
            return { success: false, error: 'Connection timed out (25s) — the model may be loading or the provider is slow' };
        }
        return { success: false, error: fetchErr.message || 'Completion ping failed' };
    }
}

// ─── Endpoint Resolvers ─────────────────────────────────────────────────────

function resolveModelsEndpoint(providerType: string, baseUrl?: string): string | null {
    const defaultEndpoints: Record<string, string> = {
        openai: 'https://api.openai.com/v1/models',
        anthropic: 'https://api.anthropic.com/v1/models',
        google: 'https://generativelanguage.googleapis.com/v1beta/models',
        deepseek: 'https://api.deepseek.com/v1/models',
        groq: 'https://api.groq.com/openai/v1/models',
        mistral: 'https://api.mistral.ai/v1/models',
        xai: 'https://api.x.ai/v1/models',
        featherless: 'https://api.featherless.ai/v1/models',
        ollama: 'http://localhost:11434/api/tags',
        together: 'https://api.together.xyz/v1/models',
        openrouter: 'https://openrouter.ai/api/v1/models',
    };

    if (baseUrl) {
        const clean = baseUrl.replace(/\/+$/, '');
        if (clean.endsWith('/v1') || clean.endsWith('/v1/')) {
            return `${clean}/models`;
        }
        if (clean.endsWith('/models')) return clean;
        return `${clean}/v1/models`;
    }

    return defaultEndpoints[providerType] || null;
}

function resolveCompletionsEndpoint(providerType: string, baseUrl?: string): string | null {
    if (baseUrl) {
        const clean = baseUrl.replace(/\/+$/, '');
        if (clean.endsWith('/v1') || clean.endsWith('/v1/')) {
            return `${clean}/chat/completions`;
        }
        return `${clean}/v1/chat/completions`;
    }

    const defaults: Record<string, string> = {
        openai: 'https://api.openai.com/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/v1/chat/completions',
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        mistral: 'https://api.mistral.ai/v1/chat/completions',
        xai: 'https://api.x.ai/v1/chat/completions',
        featherless: 'https://api.featherless.ai/v1/chat/completions',
        together: 'https://api.together.xyz/v1/chat/completions',
        openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    };

    return defaults[providerType] || null;
}

