/**
 * Station-OS — Supabase Edge Function: classify-entity
 *
 * Proxy called by the Admin UI (KnowledgePanelSection) when classifying
 * an unknown product code or account name. Forwards the request to the
 * knowledge_updater Google Cloud Function with server-side auth so the
 * GCF URL and token are never exposed to the browser.
 *
 * Environment variables (Supabase dashboard → Edge Functions → Secrets):
 *   KNOWLEDGE_UPDATER_URL — GCF URL for the knowledge_updater function
 *   GCF_AUTH_TOKEN        — optional Bearer token if GCF requires auth
 *
 * Deploy:
 *   supabase functions deploy classify-entity
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const KNOWLEDGE_UPDATER_URL = Deno.env.get('KNOWLEDGE_UPDATER_URL') ?? '';
const GCF_AUTH_TOKEN        = Deno.env.get('GCF_AUTH_TOKEN') ?? '';
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify the caller is an authenticated Admin by checking allowed_emails
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate the JWT against allowed_emails (Admin only)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: allowed } = await supabase
      .from('allowed_emails')
      .select('email')
      .ilike('email', user.email)
      .limit(1)
      .maybeSingle();

    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden — Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.station_id || !body.raw_code || !body.canonical_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: station_id, raw_code, canonical_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!KNOWLEDGE_UPDATER_URL) {
      console.error('[classify-entity] KNOWLEDGE_UPDATER_URL not configured');
      return new Response(JSON.stringify({ error: 'Knowledge updater not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Forward to knowledge_updater GCF
    const gcfHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (GCF_AUTH_TOKEN) gcfHeaders['Authorization'] = `Bearer ${GCF_AUTH_TOKEN}`;

    const gcfResp = await fetch(KNOWLEDGE_UPDATER_URL, {
      method:  'POST',
      headers: gcfHeaders,
      body:    JSON.stringify(body),
    });

    const result = await gcfResp.json().catch(() => ({ error: 'GCF returned non-JSON response' }));

    console.log(
      `[classify-entity] GCF responded ${gcfResp.status} for code=${body.raw_code} station=${body.station_id}`
    );

    return new Response(JSON.stringify(result), {
      status:  gcfResp.ok ? 200 : gcfResp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[classify-entity] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status:  500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
