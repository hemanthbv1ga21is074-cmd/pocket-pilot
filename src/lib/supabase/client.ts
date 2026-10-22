import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { getEnv } from '@/lib/env';

/**
 * Returns the browser Supabase client using only the public anon key.
 * @supabase/ssr automatically manages browser singleton caching.
 */
export function getSupabaseBrowserClient() {
  const env = getEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
