import type { Json } from "@/integrations/supabase/types";
import { parseCatalogPage, type CatalogPage } from "@/lib/catalog";
import { callSupabaseRpc } from "@/lib/supabase-rpc";

export async function fetchHomeLaunchProducts(): Promise<CatalogPage> {
  return parseCatalogPage(await callSupabaseRpc<Json>("storefront_launch_products"));
}
