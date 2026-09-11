import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import {
  buildOptimizedExternalImageUrl,
  buildR2DerivativeSrcSet,
  buildR2PublicImageUrl,
  buildResponsiveExternalImageSrcSet,
} from "@/lib/product-images";

export const CATALOG_DEFAULT_PAGE_SIZE = 24;
export const CATALOG_PAGE_SIZES = [12, 24, 48] as const;

export const catalogSortSchema = z.enum([
  "featured",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
]);

export type CatalogSort = z.infer<typeof catalogSortSchema>;

export interface CatalogQuery {
  q?: string;
  campeonato?: string;
  liga?: string;
  time?: string;
  category?: string;
  season?: string;
  brand?: string;
  audience?: string;
  commercialType?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: CatalogSort;
  page?: number;
  pageSize?: (typeof CATALOG_PAGE_SIZES)[number];
}

export interface CatalogListItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  promotional_price: number | null;
  stock: number;
  category: string | null;
  campeonato: string | null;
  liga: string | null;
  time: string | null;
  season: string | null;
  brand: string | null;
  audience: string | null;
  commercial_type: string | null;
  created_at: string;
  image_storage_key: string | null;
  image_card_storage_key: string | null;
  image_thumb_storage_key: string | null;
  image_external_url: string | null;
  image_source: string | null;
  fallback_image_url: string | null;
  displayImageUrl: string | null;
  displayImageSrcSet: string | null;
}

export interface CatalogPage {
  items: CatalogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CatalogFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface CatalogFacets {
  categories: CatalogFacetOption[];
  campeonatos: CatalogFacetOption[];
  ligas: CatalogFacetOption[];
  times: CatalogFacetOption[];
  seasons: CatalogFacetOption[];
  brands: CatalogFacetOption[];
  audiences: CatalogFacetOption[];
  commercialTypes: CatalogFacetOption[];
  priceMin: number;
  priceMax: number;
}

const catalogItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  price: z.coerce.number().nonnegative(),
  promotional_price: z.coerce.number().nonnegative().nullable(),
  stock: z.coerce.number().int().nonnegative(),
  category: z.string().nullable(),
  campeonato: z.string().nullable(),
  liga: z.string().nullable(),
  time: z.string().nullable(),
  season: z.string().nullable().optional().default(null),
  brand: z.string().nullable().optional().default(null),
  audience: z.string().nullable().optional().default(null),
  commercial_type: z.string().nullable().optional().default(null),
  created_at: z.string(),
  image_storage_key: z.string().nullable(),
  image_card_storage_key: z.string().nullable().optional().default(null),
  image_thumb_storage_key: z.string().nullable().optional().default(null),
  image_external_url: z.string().url().nullable().optional().default(null),
  image_source: z.string().nullable().optional().default(null),
  fallback_image_url: z.string().nullable(),
});

const catalogPageSchema = z.object({
  items: z.array(catalogItemSchema),
  total: z.coerce.number().int().nonnegative(),
  page: z.coerce.number().int().positive(),
  pageSize: z.coerce.number().int().min(1).max(48),
  totalPages: z.coerce.number().int().nonnegative(),
});

const facetOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.coerce.number().int().nonnegative(),
});

const catalogFacetsSchema = z.object({
  categories: z.array(facetOptionSchema),
  campeonatos: z.array(facetOptionSchema),
  ligas: z.array(facetOptionSchema),
  times: z.array(facetOptionSchema),
  seasons: z.array(facetOptionSchema),
  brands: z.array(facetOptionSchema),
  audiences: z.array(facetOptionSchema),
  commercialTypes: z.array(facetOptionSchema),
  priceMin: z.coerce.number().nonnegative(),
  priceMax: z.coerce.number().nonnegative(),
});

export function parseCatalogPage(value: Json): CatalogPage {
  const parsed = catalogPageSchema.parse(value);
  return {
    ...parsed,
    items: parsed.items.map((item) => {
      const r2Card = item.image_card_storage_key
        ? buildR2PublicImageUrl(item.image_card_storage_key)
        : null;
      const r2Main = item.image_storage_key ? buildR2PublicImageUrl(item.image_storage_key) : null;
      const externalSource = item.image_external_url ?? item.fallback_image_url;
      const displayImageUrl =
        r2Card ??
        r2Main ??
        buildOptimizedExternalImageUrl(externalSource, 768) ??
        item.image_external_url ??
        item.fallback_image_url;
      const displayImageSrcSet = r2Card
        ? buildR2DerivativeSrcSet({
            thumbStorageKey: item.image_thumb_storage_key,
            cardStorageKey: item.image_card_storage_key,
          })
        : r2Main
          ? null
          : buildResponsiveExternalImageSrcSet(externalSource);

      return {
        ...item,
        displayImageUrl,
        displayImageSrcSet,
      };
    }),
  };
}

export function parseCatalogFacets(value: Json): CatalogFacets {
  return catalogFacetsSchema.parse(value);
}

export function normalizeCatalogQuery(
  query: CatalogQuery,
): Required<Pick<CatalogQuery, "sort" | "page" | "pageSize">> & CatalogQuery {
  const pageSize = CATALOG_PAGE_SIZES.includes(
    query.pageSize as (typeof CATALOG_PAGE_SIZES)[number],
  )
    ? query.pageSize
    : CATALOG_DEFAULT_PAGE_SIZE;

  return {
    ...query,
    sort: query.sort ?? "featured",
    page: Math.max(1, query.page ?? 1),
    pageSize: pageSize ?? CATALOG_DEFAULT_PAGE_SIZE,
  };
}

export function countActiveCatalogFilters(query: CatalogQuery) {
  const values = [
    query.category,
    query.campeonato,
    query.liga,
    query.time,
    query.season,
    query.brand,
    query.audience,
    query.commercialType,
  ];
  const discrete = values.filter(Boolean).length;
  const price = query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0;
  return discrete + price;
}

export function withoutPage(query: CatalogQuery): CatalogQuery {
  const next = { ...query };
  delete next.page;
  return next;
}
