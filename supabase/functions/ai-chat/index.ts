/**
 * Station-OS — Edge Function: ai-chat
 *
 * SSE chat assistant with Claude tool use. Streams events to the browser:
 *   conversation | text_delta | tool_call | tool_result | done | error
 *
 * Secrets (dashboard → Edge Functions → Secrets):
 *   ANTHROPIC_API_KEY
 *   ANTHROPIC_CHAT_MODEL   (default claude-sonnet-4-6)
 *   OPENAI_API_KEY
 *   OPENAI_EMBEDDING_MODEL (default text-embedding-3-small)
 *
 * Deploy: supabase functions deploy ai-chat
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AuthError, requireAuth } from '../_shared/auth.ts';
import { buildSystemPrompt } from '../_shared/prompts.ts';
import { TOOLS, executeTool } from '../_shared/tools.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL             = Deno.env.get('ANTHROPIC_CHAT_MODEL') || 'claude-sonnet-4-6';
const MAX_TOKENS        = 4096;
const MAX_TOOL_ROUNDS   = 6;

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

type AnthropicMessage = { role: 'user' | 'assistant'; content: string | AnthropicBlock[] };

type AnthropicResponse = {
  content: AnthropicBlock[];
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    if (e instanceof AuthError) return jsonResponse({ error: e.code }, e.status);
    return jsonResponse({ error: 'auth_failed' }, 500);
  }

  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'anthropic_not_configured' }, 503);

  let body: { conversation_id?: string; station_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  const message = (body.message ?? '').trim();
  if (!message) return jsonResponse({ error: 'empty_message' }, 400);

  const supabase = auth.userScopedClient;

  // Build conversation (create if missing) and insert user message
  const { data: ownedStations } = await supabase.from('stations').select('id');
  const stationCount = (ownedStations ?? []).length;

  const conversationId = await ensureConversation(supabase, {
    conversationId: body.conversation_id,
    stationId: body.station_id,
    ownerEmail: auth.email,
    firstUserMessage: message,
  });

  await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message,
    status: 'complete',
  });

  const history = await loadHistory(supabase, conversationId, /*excludeLatestUser=*/ true);
  const messages: AnthropicMessage[] = [...history, { role: 'user', content: message }];

  const systemPrompt = buildSystemPrompt({
    email: auth.email,
    isSuperadmin: auth.isSuperadmin,
    stationCount,
    stationId: body.station_id,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send('conversation', { conversation_id: conversationId });

        const assistantBlocks: AnthropicBlock[] = [];
        const citations: Array<{ chunk_id: string; document_id: string; score: number; snippet: string }> = [];
        let totalIn = 0;
        let totalOut = 0;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const resp = await callAnthropic({
            system: systemPrompt,
            messages,
            tools: TOOLS,
          });
          totalIn  += resp.usage.input_tokens;
          totalOut += resp.usage.output_tokens;

          for (const block of resp.content) {
            assistantBlocks.push(block);
            if (block.type === 'text') {
              send('text_delta', { text: block.text });
            } else if (block.type === 'tool_use') {
              send('tool_call', { id: block.id, name: block.name, input: block.input });
            }
          }

          if (resp.stop_reason !== 'tool_use') {
            messages.push({ role: 'assistant', content: resp.content });
            break;
          }

          messages.push({ role: 'assistant', content: resp.content });

          const toolResults: AnthropicBlock[] = [];
          for (const block of resp.content) {
            if (block.type !== 'tool_use') continue;
            const result = await executeTool(block.name, block.input, supabase);
            if (result.citations?.length) citations.push(...result.citations);
            send('tool_result', {
              tool_use_id: block.id,
              name: block.name,
              preview: result.content.slice(0, 300),
              is_error: !!result.is_error,
            });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result.content,
              is_error: result.is_error,
            });
          }
          messages.push({ role: 'user', content: toolResults });
        }

        const assistantText = assistantBlocks
          .filter((b): b is Extract<AnthropicBlock, { type: 'text' }> => b.type === 'text')
          .map((b) => b.text)
          .join('');

        const { data: inserted } = await supabase
          .from('ai_messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantText,
            content_blocks: assistantBlocks,
            citations,
            model: MODEL,
            input_tokens: totalIn,
            output_tokens: totalOut,
            status: 'complete',
            finished_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();

        send('done', {
          message_id: inserted?.id,
          input_tokens: totalIn,
          output_tokens: totalOut,
          citations_count: citations.length,
        });
        controller.close();
      } catch (e) {
        console.error('[ai-chat] stream error:', e);
        send('error', { message: (e as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

async function callAnthropic(input: {
  system: string;
  messages: AnthropicMessage[];
  tools: typeof TOOLS;
}): Promise<AnthropicResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':        ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':     'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: input.system,
      messages: input.messages,
      tools: input.tools,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`anthropic ${res.status}: ${text.slice(0, 500)}`);
  }
  return await res.json() as AnthropicResponse;
}

async function ensureConversation(
  supabase: SupabaseClient,
  opts: { conversationId?: string; stationId?: string; ownerEmail: string; firstUserMessage: string },
): Promise<string> {
  if (opts.conversationId) return opts.conversationId;
  const title = opts.firstUserMessage.slice(0, 60) + (opts.firstUserMessage.length > 60 ? '…' : '');
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({
      tenant_owner_email: opts.ownerEmail,
      user_email: opts.ownerEmail,
      station_id: opts.stationId ?? null,
      title,
    })
    .select('id')
    .single();
  if (error) throw new Error(`No pude crear la conversación: ${error.message}`);
  return (data as { id: string }).id;
}

async function loadHistory(
  supabase: SupabaseClient,
  conversationId: string,
  excludeLatestUser: boolean,
): Promise<AnthropicMessage[]> {
  const { data } = await supabase
    .from('ai_messages')
    .select('role, content, content_blocks')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(50);

  const rows = (data ?? []) as Array<{ role: string; content: string; content_blocks: AnthropicBlock[] | null }>;
  const history: AnthropicMessage[] = [];
  for (const r of rows) {
    if (r.role === 'user')              history.push({ role: 'user', content: r.content });
    else if (r.role === 'assistant' && r.content_blocks) history.push({ role: 'assistant', content: r.content_blocks });
    else if (r.role === 'assistant')    history.push({ role: 'assistant', content: r.content });
  }
  if (excludeLatestUser && history.length > 0 && history[history.length - 1].role === 'user') {
    history.pop();
  }
  return history;
}
