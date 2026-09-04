import { supabase } from "@/integrations/supabase/client";

type RpcResponse = {
  data: unknown;
  error: { message?: string } | null;
};

type DynamicRpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<RpcResponse>;
};

export async function callSupabaseRpc<T>(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const client = supabase as unknown as DynamicRpcClient;
  const { data, error } = await client.rpc(functionName, args);

  if (error) {
    throw new Error(error.message || "Não foi possível concluir a operação agora.");
  }

  return data as T;
}
