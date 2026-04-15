/**
 * Station-OS — Supabase Edge Function: process-station-file
 *
 * Acts as the single HTTP endpoint called by edge_agent/uploader.py after
 * every file batch insert. Routes to the appropriate Google Cloud Functions:
 *
 *   P / S files  →  reconciler GCF        (compare declared vs transactional totals)
 *
 * GCF calls are fire-and-forget: ingestion is never blocked by cloud logic.
 *
 * Environment variables (set in Supabase dashboard → Edge Functions → Secrets):
 *   RECONCILER_URL        — GCF URL for the reconciler function
 *   GCF_AUTH_TOKEN        — optional Bearer token if GCFs require authentication
 *
 * Deploy:
 *   supabase functions deploy process-station-file
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RECONCILER_URL       = Deno.env.get('RECONCILER_URL') ?? '';
const GCF_AUTH_TOKEN       = Deno.env.get('GCF_AUTH_TOKEN') ?? '';

const gcfHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(GCF_AUTH_TOKEN ? { Authorization: `Bearer ${GCF_AUTH_TOKEN}` } : {}),
};

/** Fire-and-forget POST to a GCF. Never throws — logs errors silently. */
async function callGCF(url: string, body: Record<string, unknown>): Promise<void> {
  if (!url) {
    console.warn('[process-station-file] GCF URL not configured — skipping call');
    return;
  }
  try {
    const resp = await fetch(url, {
      method:  'POST',
      headers: gcfHeaders,
      body:    JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[process-station-file] GCF ${url} returned ${resp.status}: ${text.slice(0, 300)}`);
    } else {
      const json = await resp.json().catch(() => ({}));
      console.log(`[process-station-file] GCF ${url} ok:`, JSON.stringify(json));
    }
  } catch (err) {
    // Never let GCF failures surface back to the uploader
    console.error(`[process-station-file] GCF call failed (${url}):`, err);
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { station_id, shift_date, action, file_type } = body as {
    station_id?: string;
    shift_date?: string;
    action?: string;
    file_type?: string;
  };

  if (!station_id || !shift_date) {
    return new Response(JSON.stringify({ error: 'Missing station_id or shift_date' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(
    `[process-station-file] station=${station_id} date=${shift_date} action=${action ?? 'auto'} file_type=${file_type ?? '?'}`
  );

  const gcfPayload = { station_id, shift_date };

  // Only P/S files trigger reconciliation. Other file types are ingested without GCF calls.
  const resolvedAction = action ?? (file_type ? 'skip' : 'reconcile');

  if (resolvedAction === 'reconcile') {
    await callGCF(RECONCILER_URL, gcfPayload);
  }

  return new Response(
    JSON.stringify({ status: 'dispatched', station_id, shift_date }),
    { status: 202, headers: { 'Content-Type': 'application/json' } },
  );
});
