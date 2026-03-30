/**
 * Station-OS — Knowledge Service
 *
 * Handles all client-side calls related to station_knowledge:
 *  - fetchStationKnowledge: read the knowledge blob(s) directly from Supabase
 *  - classifyEntity: POST to the classify-entity Edge Function (→ knowledge_updater GCF)
 */

import { supabase } from './supabaseClient';
import { dbToStationKnowledge } from '../utils/mappers';
import { StationKnowledge, ProductType, AccountType } from '../types';

// ── Read ──────────────────────────────────────────────────────────────────────

export async function fetchStationKnowledge(stationId?: string): Promise<StationKnowledge[]> {
  let query = supabase
    .from('station_knowledge')
    .select('*')
    .order('last_updated', { ascending: false });

  if (stationId) query = query.eq('station_id', stationId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(dbToStationKnowledge);
}

// ── Write (via Edge Function → GCF) ──────────────────────────────────────────

export interface ClassifyProductPayload {
  stationId: string;
  rawCode: string;
  canonicalName: string;
  productType: ProductType;
  aliases: string[];
  propagateGlobally: boolean;
}

export interface ClassifyAccountPayload {
  stationId: string;
  rawCode: string;
  canonicalName: string;
  accountType: AccountType;
  aliases: string[];
  propagateGlobally: boolean;
}

export interface ClassifyResult {
  stationsUpdated: number;
  rowsNormalized: number;
}

export async function classifyProduct(payload: ClassifyProductPayload): Promise<ClassifyResult> {
  const { data, error } = await supabase.functions.invoke('classify-entity', {
    body: {
      station_id:         payload.stationId,
      entity_type:        'product',
      raw_code:           payload.rawCode,
      canonical_name:     payload.canonicalName,
      product_type:       payload.productType,
      aliases:            payload.aliases,
      propagate_globally: payload.propagateGlobally,
    },
  });

  if (error) throw error;
  return {
    stationsUpdated: data?.stations_updated ?? 0,
    rowsNormalized:  data?.rows_normalized  ?? 0,
  };
}

export async function classifyAccount(payload: ClassifyAccountPayload): Promise<ClassifyResult> {
  const { data, error } = await supabase.functions.invoke('classify-entity', {
    body: {
      station_id:         payload.stationId,
      entity_type:        'account',
      raw_code:           payload.rawCode,
      canonical_name:     payload.canonicalName,
      account_type:       payload.accountType,
      aliases:            payload.aliases,
      propagate_globally: payload.propagateGlobally,
    },
  });

  if (error) throw error;
  return {
    stationsUpdated: data?.stations_updated ?? 0,
    rowsNormalized:  data?.rows_normalized  ?? 0,
  };
}
