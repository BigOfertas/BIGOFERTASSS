import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Json } from "@/integrations/supabase/types";
import { parseCatalogPage } from "@/lib/catalog";
import { callSupabaseRpc } from "@/lib/supabase-rpc";

const SEARCH_DEBOUNCE_MS = 250;

export function useCatalogSearchSuggestions(query: string) {
  const normalized = query.trim();
  const [debounced, setDebounced] = useState(normalized.length >= 2 ? normalized : "");

  useEffect(() => {
    if (normalized.length < 2) {
      setDebounced("");
      return;
    }

    const timer = window.setTimeout(() => setDebounced(normalized), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalized]);

  return useQuery({
    queryKey: ["catalog", "suggestions-v2", debounced.toLocaleLowerCase("pt-BR")],
    enabled: debounced.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const data = await callSupabaseRpc<Json>("catalog_products_page_v2", {
        p_query: debounced,
        p_category: null,
        p_campeonato: null,
        p_liga: null,
        p_time: null,
        p_season: null,
        p_brand: null,
        p_audience: null,
        p_commercial_type: null,
        p_min_price: null,
        p_max_price: null,
        p_sort: "newest",
        p_page: 1,
        p_page_size: 12,
      });

      return parseCatalogPage(data).items.slice(0, 6);
    },
  });
}
