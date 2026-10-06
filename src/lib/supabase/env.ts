const SUPABASE_URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

function requirePublicEnv(name: typeof SUPABASE_URL_KEY | typeof SUPABASE_PUBLISHABLE_KEY): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return {
    url: requirePublicEnv(SUPABASE_URL_KEY),
    publishableKey: requirePublicEnv(SUPABASE_PUBLISHABLE_KEY),
  };
}
