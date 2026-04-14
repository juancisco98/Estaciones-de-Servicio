/**
 * Station-OS — Edge Function: ai-conversations
 *
 * GET /functions/v1/ai-conversations              → lista conversaciones del usuario
 * GET /functions/v1/ai-conversations?id=<uuid>    → mensajes de una conversación
 *
 * Deploy: supabase functions deploy ai-conversations
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { AuthError, requireAuth } from '../_shared/auth.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET')     return jsonResponse({ error: 'method_not_allowed' }, 405);

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    if (e instanceof AuthError) return jsonResponse({ error: e.code }, e.status);
    return jsonResponse({ error: 'auth_failed' }, 500);
  }

  const url = new URL(req.url);
  const id         = url.searchParams.get('id');
  const stationId  = url.searchParams.get('station_id');

  const supabase = auth.userScopedClient;

  if (id) {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('id, role, status, content, citations, model, input_tokens, output_tokens, created_at, finished_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ messages: data ?? [] });
  }

  let q = supabase
    .from('ai_conversations')
    .select('id, title, station_id, last_message_at, pinned, archived, created_at')
    .eq('archived', false)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(50);
  if (stationId) q = q.eq('station_id', stationId);

  const { data, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ conversations: data ?? [] });
});
