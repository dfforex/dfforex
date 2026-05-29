import { json } from '../../lib/http.js';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';

export async function handler() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(200, { ok: true, signals: [], warning: 'Supabase não configurado' });
  const { data, error } = await supabase.from('strategy_signals').select('*').order('created_at', { ascending: false }).limit(50);
  return json(error ? 500 : 200, error ? { ok: false, error: error.message } : { ok: true, signals: data });
}
