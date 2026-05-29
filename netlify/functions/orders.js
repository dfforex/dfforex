import { json, options } from '../../lib/http.js';
import { requireSupabase } from '../../lib/mt5Bridge.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  const supabase = requireSupabase();
  const { data, error } = await supabase.from('trade_orders').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return json(500, { ok: false, error: error.message });
  return json(200, { ok: true, orders: data || [] });
}
