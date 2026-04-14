import { supabase } from './supabaseClient';

export type AssistantConversation = {
    id: string;
    title: string | null;
    station_id: string | null;
    last_message_at: string | null;
    pinned: boolean;
    archived: boolean;
    created_at: string;
};

export type AssistantMessage = {
    id: string;
    role: 'user' | 'assistant' | 'tool' | 'system';
    status: 'pending' | 'streaming' | 'complete' | 'error';
    content: string;
    citations: Array<{ chunk_id: string; document_id: string; score: number; snippet: string }>;
    model: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    created_at: string;
    finished_at: string | null;
};

function getFunctionsUrl(): string {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!url) throw new Error('VITE_SUPABASE_URL not configured');
    return url.replace(/\/$/, '') + '/functions/v1';
}

async function getAccessToken(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
        throw new Error('No hay sesión activa');
    }
    return data.session.access_token;
}

export async function listConversations(stationId?: string | null): Promise<AssistantConversation[]> {
    const token = await getAccessToken();
    const url = new URL(getFunctionsUrl() + '/ai-conversations');
    if (stationId) url.searchParams.set('station_id', stationId);
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`listConversations ${res.status}: ${await res.text()}`);
    const json = await res.json() as { conversations: AssistantConversation[] };
    return json.conversations;
}

export async function loadConversation(id: string): Promise<AssistantMessage[]> {
    const token = await getAccessToken();
    const url = new URL(getFunctionsUrl() + '/ai-conversations');
    url.searchParams.set('id', id);
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`loadConversation ${res.status}: ${await res.text()}`);
    const json = await res.json() as { messages: AssistantMessage[] };
    return json.messages;
}

export type ChatStreamEvent =
    | { type: 'conversation'; conversation_id: string }
    | { type: 'text_delta'; text: string }
    | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
    | { type: 'tool_result'; tool_use_id: string; name: string; preview: string; is_error: boolean }
    | { type: 'done'; message_id: string; input_tokens: number; output_tokens: number; citations_count: number }
    | { type: 'error'; message: string };

export async function* streamChat(params: {
    message: string;
    conversationId?: string;
    stationId?: string | null;
    signal?: AbortSignal;
}): AsyncGenerator<ChatStreamEvent> {
    const token = await getAccessToken();
    const res = await fetch(getFunctionsUrl() + '/ai-chat', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: params.message,
            conversation_id: params.conversationId,
            station_id: params.stationId ?? undefined,
        }),
        signal: params.signal,
    });

    if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(`chat ${res.status}: ${text.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const event = parseSSEEvent(raw);
            if (event) yield event;
        }
    }
}

function parseSSEEvent(raw: string): ChatStreamEvent | null {
    const lines = raw.split('\n');
    let eventType = '';
    let dataStr = '';
    for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice('event: '.length).trim();
        else if (line.startsWith('data: ')) dataStr += line.slice('data: '.length);
    }
    if (!eventType || !dataStr) return null;
    try {
        const data = JSON.parse(dataStr);
        return { type: eventType, ...data } as ChatStreamEvent;
    } catch {
        return null;
    }
}
