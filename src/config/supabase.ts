import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '❌ Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

/**
 * Cliente Supabase con SERVICE ROLE KEY.
 * Bypassa RLS — ideal para operaciones admin desde el backend.
 * NUNCA exponer esta key al cliente.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
