import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.112.3";

function getPublishableKey() {
  const direct = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

  if (direct) {
    return direct;
  }

  const keySet = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

  if (keySet) {
    const parsed = JSON.parse(keySet) as Record<string, string>;
    const defaultKey = parsed.default ?? Object.values(parsed)[0];

    if (defaultKey) {
      return defaultKey;
    }
  }

  throw new Error("Chave publica do Supabase nao configurada na Edge Function");
}

export async function requireOwner(request: Request): Promise<SupabaseClient> {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Response("Nao autenticado", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL nao configurada");
  }

  const supabase = createClient(supabaseUrl, getPublishableKey(), {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Response("Nao autenticado", { status: 401 });
  }

  const { data: isOwner, error: roleError } = await supabase.rpc("has_role", {
    required_role: "owner",
  });

  if (roleError) {
    throw new Error(`Falha ao validar permissao: ${roleError.message}`);
  }

  if (!isOwner) {
    throw new Response("Acesso restrito ao owner", { status: 403 });
  }

  return supabase;
}
