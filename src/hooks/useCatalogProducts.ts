import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  normalizeCatalogQuery,
  parseCatalogFacets,
  parseCatalogPage,
  type CatalogQuery,
} from "@/lib/catalog";

export function useCatalogProducts(query: CatalogQuery = {}) {
  const normalized = normalizeCatalogQuery(query);

  return useQuery({
    queryKey: ["catalog", "page", normalized],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("catalog_products_page", {
        p_query: normalized.q?.trim() || null,
        p_category: normalized.category?.trim() || null,
        p_campeonato: normalized.campeonato?.trim() || null,
        p_liga: normalized.liga?.trim() || null,
        p_time: normalized.time?.trim() || null,
        p_min_price: normalized.minPrice ?? null,
        p_max_price: normalized.maxPrice ?? null,
        p_sort: normalized.sort,
        p_page: normalized.page,
        p_page_size: normalized.pageSize,
      });

      if (error) {
        throw error;
      }

      return parseCatalogPage(data);
    },
    staleTime: 30_000,
  });
}

export function useCatalogFacets() {
  return useQuery({
    queryKey: ["catalog", "facets"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("catalog_filter_facets", {});

      if (error) {
        throw error;
      }

      return parseCatalogFacets(data);
    },
    staleTime: 5 * 60_000,
  });
}
