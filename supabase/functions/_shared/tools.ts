import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { embed } from './embeddings.ts';

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const TOOLS: AnthropicTool[] = [
  {
    name: 'search_knowledge_base',
    description:
      'Busca documentos técnicos en la knowledge base (manuales de surtidores, impresoras fiscales Epson/Hasar, lectores de tarjeta, runbooks, logs históricos). Usar cuando el usuario pregunta cómo resolver un problema técnico, el significado de un código de error, o procedimientos operativos. Devuelve chunks relevantes con citas.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Consulta en lenguaje natural. Ej: "surtidor no imprime ticket", "error E4 impresora fiscal".' },
        equipment: { type: 'array', items: { type: 'string' }, description: "Filtro opcional por equipo: 'epson','hasar','payway','mercadopago','vb-system'." },
        error_codes: { type: 'array', items: { type: 'string' }, description: 'Filtro opcional por códigos de error (ej: ["E4","FISCAL_304"]).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'query_sales',
    description:
      'Consulta ventas agregadas de una estación. Devuelve totales por producto y/o turno en un rango de fechas. Usar cuando el usuario pregunta cuánto vendió, ventas por combustible, comparaciones temporales.',
    input_schema: {
      type: 'object',
      properties: {
        station_id: { type: 'string', description: 'UUID de la estación. Omitir = todas las estaciones del dueño.' },
        from_date: { type: 'string', description: 'Fecha inicial YYYY-MM-DD (inclusive).' },
        to_date: { type: 'string', description: 'Fecha final YYYY-MM-DD (inclusive).' },
        group_by: { type: 'string', enum: ['product', 'day', 'turno', 'station'], description: 'Cómo agrupar los resultados.' },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'get_tank_status',
    description: 'Último nivel conocido de cada tanque de una estación. Devuelve tanque, producto, litros y timestamp.',
    input_schema: {
      type: 'object',
      properties: {
        station_id: { type: 'string', description: 'UUID de la estación. Omitir = todas.' },
      },
    },
  },
  {
    name: 'list_open_incidents',
    description: 'Lista los incidentes no resueltos (status open/triaging/awaiting_user) de las estaciones del dueño.',
    input_schema: {
      type: 'object',
      properties: {
        station_id: { type: 'string' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      },
    },
  },
  {
    name: 'list_recent_alerts',
    description: 'Últimas alertas generadas (rule engine o IA). Útil para chequear estado operativo.',
    input_schema: {
      type: 'object',
      properties: {
        station_id: { type: 'string' },
        only_unresolved: { type: 'boolean', description: 'Default true.' },
        limit: { type: 'number', description: 'Default 20, máximo 100.' },
      },
    },
  },
];

export type ToolExecutionResult = {
  content: string;
  citations?: Array<{ chunk_id: string; document_id: string; score: number; snippet: string }>;
  is_error?: boolean;
};

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<ToolExecutionResult> {
  try {
    switch (name) {
      case 'search_knowledge_base': return await searchKnowledgeBase(input, supabase);
      case 'query_sales':           return await querySales(input, supabase);
      case 'get_tank_status':       return await getTankStatus(input, supabase);
      case 'list_open_incidents':   return await listOpenIncidents(input, supabase);
      case 'list_recent_alerts':    return await listRecentAlerts(input, supabase);
      default:                      return { content: `Unknown tool: ${name}`, is_error: true };
    }
  } catch (e) {
    return { content: `Error ejecutando ${name}: ${(e as Error).message}`, is_error: true };
  }
}

async function searchKnowledgeBase(input: Record<string, unknown>, supabase: SupabaseClient): Promise<ToolExecutionResult> {
  const query = String(input.query ?? '').trim();
  if (!query) return { content: 'query vacía', is_error: true };

  const equipment = Array.isArray(input.equipment) ? input.equipment as string[] : null;
  const errorCodes = Array.isArray(input.error_codes) ? input.error_codes as string[] : null;

  const embedding = await embed(query);

  const { data, error } = await supabase.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold: 0.65,
    match_count: 6,
    filter_equipment: equipment,
    filter_error_codes: errorCodes,
    filter_station_id: null,
  });
  if (error) return { content: `RPC error: ${error.message}`, is_error: true };

  const rows = (data ?? []) as Array<{
    chunk_id: string; document_id: string; document_title: string; source_type: string;
    content: string; similarity: number; is_global: boolean;
  }>;
  if (rows.length === 0) return { content: 'No se encontraron documentos relevantes en la knowledge base.' };

  const body = rows.map((r, i) =>
    `[${i + 1}] "${r.document_title}" (${r.source_type}, sim=${r.similarity.toFixed(2)}${r.is_global ? ', global' : ''})\n${r.content}`
  ).join('\n\n---\n\n');

  return {
    content: body,
    citations: rows.map((r) => ({
      chunk_id: r.chunk_id,
      document_id: r.document_id,
      score: r.similarity,
      snippet: r.content.slice(0, 200),
    })),
  };
}

async function querySales(input: Record<string, unknown>, supabase: SupabaseClient): Promise<ToolExecutionResult> {
  const fromDate = String(input.from_date);
  const toDate   = String(input.to_date);
  const stationId = input.station_id ? String(input.station_id) : null;
  const groupBy = (input.group_by as string) ?? 'product';

  let q = supabase
    .from('sales_transactions')
    .select('product_name, product_code, shift_date, turno, station_id, quantity, total_amount')
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate);
  if (stationId) q = q.eq('station_id', stationId);

  const { data, error } = await q.limit(5000);
  if (error) return { content: `DB error: ${error.message}`, is_error: true };
  const rows = data ?? [];
  if (rows.length === 0) return { content: 'No hay ventas en el rango indicado.' };

  const agg = new Map<string, { qty: number; total: number; count: number }>();
  for (const r of rows as Array<Record<string, unknown>>) {
    let key: string;
    switch (groupBy) {
      case 'day':     key = String(r.shift_date); break;
      case 'turno':   key = `Turno ${r.turno}`; break;
      case 'station': key = String(r.station_id); break;
      default:        key = String(r.product_name);
    }
    const cur = agg.get(key) ?? { qty: 0, total: 0, count: 0 };
    cur.qty   += Number(r.quantity ?? 0);
    cur.total += Number(r.total_amount ?? 0);
    cur.count += 1;
    agg.set(key, cur);
  }

  const lines = [...agg.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 50)
    .map(([k, v]) => `${k}: ${v.count} tx, ${v.qty.toFixed(2)} unidades, $${v.total.toFixed(2)}`);

  return { content: `Ventas ${fromDate} → ${toDate} (agrupadas por ${groupBy}):\n${lines.join('\n')}` };
}

async function getTankStatus(input: Record<string, unknown>, supabase: SupabaseClient): Promise<ToolExecutionResult> {
  const stationId = input.station_id ? String(input.station_id) : null;
  let q = supabase
    .from('tank_levels')
    .select('station_id, tank_id, product_name, level_liters, capacity_liters, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(500);
  if (stationId) q = q.eq('station_id', stationId);

  const { data, error } = await q;
  if (error) return { content: `DB error: ${error.message}`, is_error: true };

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const latest = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const key = `${r.station_id}:${r.tank_id}`;
    if (!latest.has(key)) latest.set(key, r);
  }
  if (latest.size === 0) return { content: 'Sin registros de tanques.' };

  const lines = [...latest.values()].map((r) =>
    `${r.tank_id} (${r.product_name}): ${Number(r.level_liters).toFixed(0)}L${r.capacity_liters ? ` / ${Number(r.capacity_liters).toFixed(0)}L` : ''} @ ${r.recorded_at}`
  );
  return { content: `Últimos niveles conocidos:\n${lines.join('\n')}` };
}

async function listOpenIncidents(input: Record<string, unknown>, supabase: SupabaseClient): Promise<ToolExecutionResult> {
  const stationId = input.station_id ? String(input.station_id) : null;
  const severity  = input.severity ? String(input.severity) : null;

  let q = supabase
    .from('incidents')
    .select('id, station_id, title, severity, status, equipment, error_codes, created_at')
    .in('status', ['open', 'triaging', 'awaiting_user'])
    .order('created_at', { ascending: false })
    .limit(50);
  if (stationId) q = q.eq('station_id', stationId);
  if (severity)  q = q.eq('severity', severity);

  const { data, error } = await q;
  if (error) return { content: `DB error: ${error.message}`, is_error: true };
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return { content: 'No hay incidentes abiertos.' };

  const lines = rows.map((r) =>
    `[${r.severity}] ${r.title} (status=${r.status}, equipos=${((r.equipment as string[]) ?? []).join(',') || '—'}) @ ${r.created_at}`
  );
  return { content: `${rows.length} incidente(s) abierto(s):\n${lines.join('\n')}` };
}

async function listRecentAlerts(input: Record<string, unknown>, supabase: SupabaseClient): Promise<ToolExecutionResult> {
  const stationId = input.station_id ? String(input.station_id) : null;
  const onlyUnresolved = input.only_unresolved !== false;
  const limit = Math.min(Number(input.limit ?? 20), 100);

  let q = supabase
    .from('alerts')
    .select('id, station_id, level, type, title, source, resolved, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (stationId)       q = q.eq('station_id', stationId);
  if (onlyUnresolved)  q = q.eq('resolved', false);

  const { data, error } = await q;
  if (error) return { content: `DB error: ${error.message}`, is_error: true };
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return { content: 'Sin alertas en los criterios.' };

  const lines = rows.map((r) =>
    `[${r.level}/${r.source}] ${r.type}: ${r.title} (${r.resolved ? 'resuelta' : 'abierta'}) @ ${r.created_at}`
  );
  return { content: `${rows.length} alerta(s):\n${lines.join('\n')}` };
}
