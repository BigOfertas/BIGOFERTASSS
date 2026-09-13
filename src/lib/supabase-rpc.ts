import { supabase } from "@/integrations/supabase/client";

type RpcFailure = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
};

type RpcResponse = {
  data: unknown;
  error: RpcFailure | null;
};

type DynamicRpcClient = {
  rpc: (functionName: string, args?: Record<string, unknown>) => PromiseLike<RpcResponse>;
};

export async function callSupabaseRpc<T>(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const client = supabase as unknown as DynamicRpcClient;
  const { data, error } = await client.rpc(functionName, args);

  if (error) {
    // Mantém a interface amigável, mas não engole o diagnóstico técnico.
    // Não registramos os argumentos da RPC porque eles podem conter dados sensíveis.
    console.error(`[Supabase RPC] ${functionName} failed`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      status: error.status,
    });

    const rpcError = new Error(error.message || "Não foi possível concluir a operação agora.");
    rpcError.name = "SupabaseRpcError";
    throw rpcError;
  }

  return data as T;
}
