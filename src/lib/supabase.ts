import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && publishableKey);

// Disabled by default. Enable only after the trusted delete-account function is deployed and tested.
export const accountDeletionEnabled = import.meta.env.VITE_ACCOUNT_DELETION_ENABLED === "true";

export const supabase = supabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
