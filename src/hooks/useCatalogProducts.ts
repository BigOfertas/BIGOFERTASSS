import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { Json } from "@/integrations/supabase/types";
import {
  normalizeCatalogQuery,
  parseCatalogFacets,
  parseCatalogPage,
  type CatalogQuery,
} from "@/lib/catalog";
import { callSupabaseRpc } from "@/lib/supabase-rpc";

function catalogFilterArgs(query: CatalogQuery) {
  return {
    p_query: query.q?.trim() || null,
    p_category: query.category?.trim() || null,
    p_campeonato: query.campeonato?.trim() || null,
    p_liga: query.liga?.trim() || null,
    p_time: query.time?.trim() || null,
    p_season: query.season?.trim() || null,
    p_brand: query.brand?.trim() || null,
    p_audience: query.audience?.trim() || null,
    p_commercial_type: query.commercialType?.trim() || null,
    p_min_price: query.minPrice ?? null,
    p_max_price: query.maxPrice ?? null,
  };
}

export function useCatalogProducts(query: CatalogQuery = {}) {
  const normalized = normalizeCatalogQuery(query);

  return useQuery({
    queryKey: ["catalog", "page-v3", normalized],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const data = await callSupabaseRpc<Json>("catalog_products_page_v3", {
        ...catalogFilterArgs(normalized),
        p_sort: normalized.sort,
        p_page: normalized.page,
        p_page_size: normalized.pageSize,
      });

      return parseCatalogPage(data);
    },
    staleTime: 30_000,
  });
}

export function useCatalogFacets(query: CatalogQuery = {}) {
  const facetQuery: CatalogQuery = {
    q: query.q,
    category: query.category,
    campeonato: query.campeonato,
    liga: query.liga,
    time: query.time,
    season: query.season,
    brand: query.brand,
    audience: query.audience,
    commercialType: query.commercialType,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
  };

  return useQuery({
    queryKey: ["catalog", "facets-v2", facetQuery],
    queryFn: async () => {
      const data = await callSupabaseRpc<Json>(
        "catalog_filter_facets_v2",
        catalogFilterArgs(facetQuery),
      );
      return parseCatalogFacets(data);
    },
    staleTime: 60_000,
  });
}
