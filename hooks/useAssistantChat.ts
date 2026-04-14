import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    AssistantMessage,
    loadConversation,
    streamChat,
} from '../services/aiService';

export type UIMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: Array<{ chunk_id: string; document_id: string; score: number; snippet: string }>;
    streaming?: boolean;
};

export type ToolActivity = {
    id: string;
    name: string;
    status: 'running' | 'done' | 'error';
};

export function useAssistantChat(options: { stationId?: string | null }) {
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [toolActivity, setToolActivity] = useState<ToolActivity[]>([]);
    const abortRef = useRef<AbortController | null>(null);

    const clearConversation = useCallback(() => {
        abortRef.current?.abort();
        setMessages([]);
        setConversationId(null);
        setToolActivity([]);
        setIsStreaming(false);
    }, []);

    const openConversation = useCallback(async (id: string) => {
        abortRef.current?.abort();
        setIsStreaming(false);
        setToolActivity([]);
        try {
            const rows: AssistantMessage[] = await loadConversation(id);
            const ui: UIMessage[] = rows
                .filter((r) => r.role === 'user' || r.role === 'assistant')
                .map((r) => ({
                    id: r.id,
                    role: r.role as 'user' | 'assistant',
                    content: r.content,
                    citations: r.citations,
                }));
            setMessages(ui);
            setConversationId(id);
        } catch (e) {
            toast.error(`No pude cargar la conversación: ${(e as Error).message}`);
        }
    }, []);

    const sendMessage = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isStreaming) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const userTempId = `u_${Date.now()}`;
        const assistantTempId = `a_${Date.now()}`;

        setMessages((prev) => [
            ...prev,
            { id: userTempId, role: 'user', content: trimmed },
            { id: assistantTempId, role: 'assistant', content: '', streaming: true },
        ]);
        setIsStreaming(true);
        setToolActivity([]);

        let accumulated = '';

        try {
            for await (const event of streamChat({
                message: trimmed,
                conversationId: conversationId ?? undefined,
                stationId: options.stationId,
                signal: controller.signal,
            })) {
                if (event.type === 'conversation') {
                    setConversationId(event.conversation_id);
                } else if (event.type === 'text_delta') {
                    accumulated += event.text;
                    setMessages((prev) =>
                        prev.map((m) => (m.id === assistantTempId ? { ...m, content: accumulated } : m)),
                    );
                } else if (event.type === 'tool_call') {
                    setToolActivity((prev) => [...prev, { id: event.id, name: event.name, status: 'running' }]);
                } else if (event.type === 'tool_result') {
                    setToolActivity((prev) =>
                        prev.map((t) =>
                            t.id === event.tool_use_id ? { ...t, status: event.is_error ? 'error' : 'done' } : t,
                        ),
                    );
                } else if (event.type === 'done') {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantTempId
                                ? { ...m, id: event.message_id ?? m.id, streaming: false }
                                : m,
                        ),
                    );
                    setIsStreaming(false);
                } else if (event.type === 'error') {
                    throw new Error(event.message);
                }
            }
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
            toast.error(`Error del asistente: ${(e as Error).message}`);
            setMessages((prev) => prev.filter((m) => m.id !== assistantTempId));
            setIsStreaming(false);
        } finally {
            if (abortRef.current === controller) abortRef.current = null;
            setIsStreaming(false);
            setTimeout(() => setToolActivity([]), 2000);
        }
    }, [conversationId, isStreaming, options.stationId]);

    const cancel = useCallback(() => {
        abortRef.current?.abort();
        setIsStreaming(false);
    }, []);

    return {
        messages,
        conversationId,
        isStreaming,
        toolActivity,
        sendMessage,
        clearConversation,
        openConversation,
        cancel,
    };
}
