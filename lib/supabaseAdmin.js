import { createClient } from '@supabase/supabase-js';
import { getConfig } from './config.js';

export function getSupabaseAdmin() {
  const cfg = getConfig();
  if (!cfg.supabase.url || !cfg.supabase.serviceRoleKey) return null;
  return createClient(cfg.supabase.url, cfg.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function insertLog(type, message, payload = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { skipped: true, reason: 'Supabase não configurado' };
  const { data, error } = await supabase.from('bot_runtime_logs').insert({
    level: type,
    message,
    payload
  }).select('id').single();
  if (error) return { error: error.message };
  return { data };
}
