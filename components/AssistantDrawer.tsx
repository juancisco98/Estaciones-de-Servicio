import React, { useEffect, useRef, useState } from 'react';
import {
    Bot,
    Loader2,
    MessageCircle,
    Send,
    Sparkles,
    Wrench,
    X,
} from 'lucide-react';
import { useAssistantChat } from '../hooks/useAssistantChat';

interface AssistantDrawerProps {
    activeStationId: string | null;
    activeStationName: string | null;
}

const TOOL_LABELS: Record<string, string> = {
    search_knowledge_base: 'Buscando en base de conocimiento',
    query_sales:           'Consultando ventas',
    get_tank_status:       'Revisando tanques',
    list_open_incidents:   'Buscando incidentes',
    list_recent_alerts:    'Revisando alertas',
};

const AssistantDrawer: React.FC<AssistantDrawerProps> = ({ activeStationId, activeStationName }) => {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const {
        messages,
        isStreaming,
        toolActivity,
        sendMessage,
        clearConversation,
        cancel,
    } = useAssistantChat({ stationId: activeStationId });

    const scrollRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, toolActivity]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isStreaming) return;
        const text = input;
        setInput('');
        void sendMessage(text);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* FAB */}
            <button
                onClick={() => setOpen((v) => !v)}
                className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[1400] flex items-center justify-center w-14 h-14 rounded-full
                    shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all duration-200 active:scale-95
                    ${open
                        ? 'bg-slate-700 hover:bg-slate-800 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
                aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
            >
                {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </button>

            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[1490] sm:hidden"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Drawer */}
            <aside
                className={`fixed inset-y-0 right-0 z-[1495] w-full sm:w-[420px] max-w-full
                    bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-white/10
                    shadow-[0_32px_80px_rgba(0,0,0,0.30),0_8px_24px_rgba(0,0,0,0.15)]
                    flex flex-col transition-transform duration-300 ease-out
                    ${open ? 'translate-x-0' : 'translate-x-full'}`}
                aria-hidden={!open}
            >
                {/* Header */}
                <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <div className="font-semibold text-slate-900 dark:text-white leading-tight">Asistente</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                                {activeStationName ? `Enfocado en ${activeStationName}` : 'Multi-estación'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {messages.length > 0 && (
                            <button
                                onClick={clearConversation}
                                className="text-xs px-2 py-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
                                title="Nueva conversación"
                            >
                                Nueva
                            </button>
                        )}
                        <button
                            onClick={() => setOpen(false)}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                            aria-label="Cerrar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40"
                >
                    {messages.length === 0 && !isStreaming && <EmptyState />}

                    {messages.map((m) => (
                        <MessageBubble key={m.id} role={m.role} content={m.content} streaming={m.streaming} />
                    ))}

                    {toolActivity.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {toolActivity.map((t) => (
                                <ToolPill key={t.id} activity={t} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Input */}
                <form
                    onSubmit={handleSend}
                    className="shrink-0 border-t border-slate-100 dark:border-white/10 px-3 py-3 bg-white dark:bg-slate-900"
                >
                    <div className="flex gap-2 items-end">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Preguntá algo… (Enter para enviar)"
                            rows={1}
                            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm
                                bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white
                                placeholder-slate-400 dark:placeholder-slate-500
                                focus:outline-none focus:ring-2 focus:ring-amber-400
                                max-h-32"
                            style={{ minHeight: 40 }}
                            disabled={isStreaming}
                        />
                        {isStreaming ? (
                            <button
                                type="button"
                                onClick={cancel}
                                className="shrink-0 w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center transition"
                                title="Cancelar"
                            >
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="shrink-0 w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition active:scale-95"
                                title="Enviar"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 pl-1">
                        Claude Sonnet 4.6 · RLS activo · solo tus datos
                    </div>
                </form>
            </aside>
        </>
    );
};

const EmptyState: React.FC = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 text-slate-500 dark:text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">Hola. Soy tu asistente.</div>
        <div className="text-xs leading-relaxed max-w-[280px]">
            Puedo consultar tus ventas, tanques, incidentes, alertas y buscar procedimientos técnicos en la base de conocimiento.
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 w-full max-w-[280px]">
            {[
                '¿Qué alertas tengo abiertas?',
                'Mostrame los tanques de hoy',
                '¿Cuánto vendí esta semana?',
            ].map((q) => (
                <div
                    key={q}
                    className="text-xs px-3 py-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                >
                    {q}
                </div>
            ))}
        </div>
    </div>
);

const MessageBubble: React.FC<{ role: 'user' | 'assistant'; content: string; streaming?: boolean }> = ({
    role,
    content,
    streaming,
}) => {
    const isUser = role === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed
                    ${isUser
                        ? 'bg-amber-500 text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 rounded-bl-sm'}`}
            >
                {content || (streaming ? <span className="inline-flex items-center gap-1 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> pensando…</span> : '')}
                {streaming && content && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-slate-400 dark:bg-slate-500 animate-pulse align-middle" />
                )}
            </div>
        </div>
    );
};

const ToolPill: React.FC<{ activity: { name: string; status: 'running' | 'done' | 'error' } }> = ({ activity }) => {
    const label = TOOL_LABELS[activity.name] ?? activity.name;
    const colors =
        activity.status === 'error'
            ? 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300'
            : activity.status === 'done'
            ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200';
    return (
        <div className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full ${colors}`}>
            {activity.status === 'running'
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Wrench className="w-3 h-3" />}
            <span>{label}</span>
        </div>
    );
};

export default AssistantDrawer;
