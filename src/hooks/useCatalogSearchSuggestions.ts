import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { parseCatalogPage } from "@/lib/catalog";

export function useCatalogSearchSuggestions(query: string) {
  const normalized = query.trim();

  return useQuery({
    queryKey: ["catalog", "suggestions", normalized.toLocaleLowerCase("pt-BR")],
    enabled: normalized.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("catalog_products_page", {
        p_query: normalized,
        p_category: null,
        p_campeonato: null,
        p_liga: null,
        p_time: null,
        p_min_price: null,
        p_max_price: null,
        p_sort: "newest",
        p_page: 1,
        p_page_size: 12,
      });

      if (error) throw error;
      return parseCatalogPage(data).items.slice(0, 6);
    },
  });
}
