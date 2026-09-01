import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";

import ProductFilters from "@/components/ProductFilters";
import Header from "@/components/layout/Header";
import ProductCard from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import {
  useCatalogFacets,
  useCatalogProducts,
} from "@/hooks/useCatalogProducts";
import {
  CATALOG_DEFAULT_PAGE_SIZE,
  CATALOG_PAGE_SIZES,
  catalogSortSchema,
  type CatalogQuery,
  type CatalogSort,
} from "@/lib/catalog";

const filterKeySchema = z
  .string()
  .trim()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const productSearchSchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    campeonato: filterKeySchema.optional(),
    liga: filterKeySchema.optional(),
    time: filterKeySchema.optional(),
    category: filterKeySchema.optional(),
    minPrice: z.coerce.number().min(0).max(1_000_000).optional(),
    maxPrice: z.coerce.number().min(0).max(1_000_000).optional(),
    sort: catalogSortSchema.optional(),
    page: z.coerce.number().int().min(1).max(100_000).optional(),
    pageSize: z
      .union([z.literal(12), z.literal(24), z.literal(48)])
      .optional(),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: "Faixa de preço inválida" },
  );

export const Route = createFileRoute("/products")({
  validateSearch: (search) => productSearchSchema.parse(search),
  component: ProductsPage,
});

function getVisiblePages(current: number, total: number) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set([1, total, current - 1, current, current + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((left, right) => left - right);
}

function ProductsPage() {
  const search = Route.useSearch() satisfies CatalogQuery;
  const navigate = useNavigate();
  const {
    data: catalog,
    isLoading,
    isFetching,
    error,
  } = useCatalogProducts(search);
  const {
    data: facets,
    isLoading: facetsLoading,
    error: facetsError,
  } = useCatalogFacets();

  const currentPage = catalog?.page ?? search.page ?? 1;
  const pageSize = catalog?.pageSize ?? search.pageSize ?? CATALOG_DEFAULT_PAGE_SIZE;
  const totalPages = catalog?.totalPages ?? 0;
  const products = catalog?.items ?? [];

  const updateSearch = (updates: CatalogQuery, resetPage = true) => {
    const next: CatalogQuery = { ...search, ...updates };

    if (resetPage) {
      delete next.page;
    }

    void navigate({ to: "/products", search: next });
  };

  const goToPage = (page: number) => {
    const next: CatalogQuery = { ...search };

    if (page <= 1) delete next.page;
    else next.page = page;

    void navigate({ to: "/products", search: next });
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <main className="flex flex-grow items-center justify-center p-8">
          <div className="text-center">
            <h2 className="mb-2 text-2xl font-bold text-red-600">
              Erro ao carregar produtos
            </h2>
            <p className="text-gray-600">
              Não foi possível consultar o catálogo agora. Tente novamente mais
              tarde.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-8 md:py-12 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 md:text-3xl">
              Produtos
            </h1>
            {search.q ? (
              <p className="mt-2 text-sm text-gray-500">
                Resultados para <strong>“{search.q}”</strong>
              </p>
            ) : null}
            {!isLoading && catalog ? (
              <p className="mt-1 text-xs text-gray-400">
                {catalog.total.toLocaleString("pt-BR")} produto(s) encontrado(s)
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
              Ordenar
              <select
                value={search.sort ?? "newest"}
                onChange={(event) =>
                  updateSearch({
                    sort: event.target.value as CatalogSort,
                  })
                }
                className="h-10 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900"
              >
                <option value="newest">Mais recentes</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
                <option value="name_asc">Nome A–Z</option>
                <option value="name_desc">Nome Z–A</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
              Exibir
              <select
                value={pageSize}
                onChange={(event) =>
                  updateSearch({
                    pageSize: Number(event.target.value) as (typeof CATALOG_PAGE_SIZES)[number],
                  })
                }
                className="h-10 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900"
              >
                {CATALOG_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="w-full flex-shrink-0 md:w-64">
            <div className="sticky top-24">
              {facets ? (
                <ProductFilters facets={facets} search={search} />
              ) : facetsLoading ? (
                <div className="space-y-8" aria-label="Carregando filtros">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="mb-4 h-4 w-24 bg-gray-100" />
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((__, j) => (
                          <div key={j} className="h-3 w-32 bg-gray-50" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : facetsError ? (
                <p className="text-sm text-gray-500">
                  Filtros temporariamente indisponíveis.
                </p>
              ) : null}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {isFetching && !isLoading ? (
              <div
                className="mb-4 h-1 w-full overflow-hidden rounded-full bg-gray-100"
                aria-label="Atualizando catálogo"
              >
                <div className="h-full w-1/3 animate-pulse bg-red-600" />
              </div>
            ) : null}

            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[4/5] animate-pulse rounded-md bg-gray-100"
                  />
                ))}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      slug={product.slug}
                      name={product.name}
                      price={product.price}
                      promotionalPrice={product.promotional_price}
                      imageUrl={product.displayImageUrl}
                    />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <nav
                    className="mt-12 flex flex-wrap items-center justify-center gap-2"
                    aria-label="Paginação do catálogo"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => goToPage(currentPage - 1)}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {getVisiblePages(currentPage, totalPages).map(
                      (page, index, visiblePages) => {
                        const previous = visiblePages[index - 1];
                        const showGap = previous !== undefined && page - previous > 1;

                        return (
                          <React.Fragment key={page}>
                            {showGap ? (
                              <span className="px-1 text-gray-400">…</span>
                            ) : null}
                            <Button
                              type="button"
                              variant={page === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => goToPage(page)}
                              aria-current={page === currentPage ? "page" : undefined}
                              className={
                                page === currentPage
                                  ? "bg-red-600 text-white hover:bg-red-700"
                                  : undefined
                              }
                            >
                              {page}
                            </Button>
                          </React.Fragment>
                        );
                      },
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => goToPage(currentPage + 1)}
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </nav>
                ) : null}
              </>
            ) : (
              <div className="py-20 text-center">
                <h2 className="text-xl font-bold uppercase text-gray-400">
                  Nenhum produto encontrado
                </h2>
                <p className="mt-2 text-gray-500">
                  Ajuste a busca ou os filtros para tentar novamente.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
