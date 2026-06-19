import { createClient } from '@supabase/supabase-js'

// Server-only Supabase client using the SERVICE ROLE key. Required for the
// re-roast + cron endpoints to UPDATE rows (RLS allows public SELECT/INSERT but
// not UPDATE). Falls back to the anon key if the service role key isn't set,
// but updates will then be blocked by RLS — so set SUPABASE_SERVICE_ROLE_KEY.
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set — re-roast/cron updates will be blocked by RLS.')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}
