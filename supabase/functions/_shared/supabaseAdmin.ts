// supabase/functions/_shared/supabaseAdmin.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database } from './database.types.ts'; // Assuming a shared types file, adjust path if needed

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  console.error('ERROR: SUPABASE_URL environment variable is not set.');
  throw new Error('SUPABASE_URL environment variable is not set. Check Edge Function environment variables.');
}
if (!supabaseServiceRoleKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.');
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set. Check Edge Function environment variables.');
}

export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
); 