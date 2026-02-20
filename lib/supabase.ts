import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  auth: {
    // navigator.locks times out in WSL2 and during Next.js fast refresh.
    // Replace with a no-op lock — safe for single-tab usage.
    lock: (_name, _acquireTimeout, fn) => fn(),
  },
});
