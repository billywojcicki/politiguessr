import { createClient } from "@supabase/supabase-js";

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        // Disable Next.js Data Cache for all Supabase fetch calls.
        // Without this, Next.js 14 caches the fetch responses server-side
        // and serves stale data even after the DB changes.
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: "no-store" }),
      },
    }
  );
}
