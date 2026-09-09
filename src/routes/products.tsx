import React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { z } from "zod";

import ProductFilters from "@/components/ProductFilters";
import Header from "@/components/layout/Header";
import { CatalogProductGrid } from "@/components/product/CatalogProductGrid";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCatalogFacets, useCatalogProducts } from "@/hooks/useCatalogProducts";
import {
  catalogSortSchema,
  countActiveCatalogFilters,
  type CatalogFacetOption,
  type CatalogQuery,
  type CatalogSort,
} from "@/lib/catalog";

const filterKeySchema = z.string().trim().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const productSearchSchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    campeonato: filterKeySchema.optional(),
    liga: filterKeySchema.optional(),
    time: filterKeySchema.optional(),
    category: filterKeySchema.optional(),
    season: filterKeySchema.optional(),
    brand: filterKeySchema.optional(),
    audience: filterKeySchema.optional(),
    commercialType: filterKeySchema.optional(),
    minPrice: z.coerce.number().min(0).max(1_000_000).optional(),
    maxPrice: z.coerce.number().min(0).max(1_000_000).optional(),
    sort: catalogSortSchema.optional(),
    page: z.coerce.number().int().min(1).max(100_000).optional(),
    pageSize: z.union([z.literal(12), z.literal(24), z.literal(48)]).optional(),
  })
  .refine(
    (value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice,
    { message: "Faixa de preço inválida" },
  );

export const Route = createFileRoute("/products")({
  validateSearch: (search) => productSearchSchema.parse(search),
  component: ProductsPage,
});

function getVisiblePages(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  return Array.from(pages).filter((page) => page >= 1 && page <= total).sort((left, right) => left - right);
}

function FilterSkeleton() {
  return (
    <div className="space-y-8" aria-label="Carregando filtros">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="mb-4 h-4 w-24 rounded bg-gray-100" />
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((__, item) => <div key={item} className="h-3 w-32 rounded bg-gray-100" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function findFacetLabel(items: CatalogFacetOption[] | undefined, value?: string) {
  if (!value) return null;
  return items?.find((item) => item.value === value)?.label ?? value.replaceAll("-", " ");
}

function ProductsPage() {
  const search = Route.useSearch() satisfies CatalogQuery;
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const { data: catalog, isLoading, isFetching, error } = useCatalogProducts(search);
  const { data: facets, isLoading: facetsLoading, error: facetsError } = useCatalogFacets(search);

  const currentPage = catalog?.page ?? search.page ?? 1;
  const totalPages = catalog?.totalPages ?? 0;
  const products = catalog?.items ?? [];
  const activeFilterCount = countActiveCatalogFilters(search);

  const updateSearch = (updates: CatalogQuery, resetPage = true) => {
    const next: CatalogQuery = { ...search, ...updates };
    if (resetPage) delete next.page;
    void navigate({ to: "/products", search: next });
  };

  const clearAllFilters = () => {
    const next: CatalogQuery = {};
    if (search.q) next.q = search.q;
    if (search.sort) next.sort = search.sort;
    void navigate({ to: "/products", search: next });
  };

  const removeFilter = (key: keyof CatalogQuery) => {
    const next: CatalogQuery = { ...search };
    delete next.page;
    delete next[key];
    if (key === "campeonato") {
      delete next.liga;
      delete next.time;
    }
    if (key === "liga") delete next.time;
    void navigate({ to: "/products", search: next });
  };

  const goToPage = (page: number) => {
    const next: CatalogQuery = { ...search };
    if (page <= 1) delete next.page;
    else next.page = page;
    void navigate({ to: "/products", search: next });
  };

  const activeFilters = facets
    ? [
        ["category", "Categoria", findFacetLabel(facets.categories, search.category)],
        ["campeonato", "Campeonato", findFacetLabel(facets.campeonatos, search.campeonato)],
        ["liga", "Liga", findFacetLabel(facets.ligas, search.liga)],
        ["time", "Time", findFacetLabel(facets.times, search.time)],
        ["season", "Temporada", findFacetLabel(facets.seasons, search.season)],
        ["brand", "Marca", findFacetLabel(facets.brands, search.brand)],
        ["commercialType", "Modelo", findFacetLabel(facets.commercialTypes, search.commercialType)],
        ["audience", "Público", findFacetLabel(facets.audiences, search.audience)],
      ].filter((entry): entry is [keyof CatalogQuery, string, string] => Boolean(entry[2]))
    : [];

  const breadcrumbTail =
    findFacetLabel(facets?.times, search.time) ??
    findFacetLabel(facets?.categories, search.category) ??
    (search.q ? `Busca: ${search.q}` : null);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <main className="flex flex-grow items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h2 className="mb-2 text-2xl font-bold text-red-600">Não foi possível carregar o catálogo</h2>
            <p className="text-gray-600">Tente novamente em instantes ou volte para a página inicial.</p>
            <Button asChild className="mt-6 bg-red-600 text-white hover:bg-black"><Link to="/">Voltar ao início</Link></Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-grow px-4 py-7 md:py-10 lg:px-8">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-500" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-red-600">Início</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/products" search={{}} className="hover:text-red-600">Produtos</Link>
          {breadcrumbTail ? <><ChevronRight className="h-3.5 w-3.5" /><span className="max-w-[260px] truncate text-gray-900" aria-current="page">{breadcrumbTail}</span></> : null}
        </nav>

        <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-gray-950 md:text-3xl">Produtos</h1>
            {search.q ? <p className="mt-2 text-sm text-gray-500">Resultados para <strong>“{search.q}”</strong></p> : null}
            {!isLoading && catalog ? <p className="mt-1 text-xs font-medium text-gray-500">{catalog.total.toLocaleString("pt-BR")} produto(s)</p> : null}
          </div>

          <label className="hidden items-center gap-2 text-xs font-bold uppercase text-gray-500 md:flex">
            Ordenar
            <select
              value={search.sort ?? "newest"}
              onChange={(event) => updateSearch({ sort: event.target.value as CatalogSort })}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900"
            >
              <option value="newest">Mais recentes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
              <option value="name_asc">Nome A–Z</option>
              <option value="name_desc">Nome Z–A</option>
            </select>
          </label>
        </div>

        {(activeFilters.length > 0 || search.minPrice !== undefined || search.maxPrice !== undefined) ? (
          <div className="mb-6 flex flex-wrap items-center gap-2 border-y border-gray-100 py-3">
            <span className="mr-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Filtros ativos</span>
            {activeFilters.map(([key, label, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => removeFilter(key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-red-200 hover:text-red-600"
                aria-label={`Remover filtro ${label}: ${value}`}
              >
                <span className="text-gray-400">{label}:</span> {value}<X className="h-3 w-3" />
              </button>
            ))}
            {(search.minPrice !== undefined || search.maxPrice !== undefined) ? (
              <button type="button" onClick={() => { const next = { ...search }; delete next.minPrice; delete next.maxPrice; delete next.page; void navigate({ to: "/products", search: next }); }} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-red-200 hover:text-red-600">
                <span className="text-gray-400">Preço:</span> {search.minPrice !== undefined ? `R$ ${search.minPrice}` : "mín."} – {search.maxPrice !== undefined ? `R$ ${search.maxPrice}` : "máx."}<X className="h-3 w-3" />
              </button>
            ) : null}
            <button type="button" onClick={clearAllFilters} className="ml-1 text-xs font-black text-red-600 hover:text-black">Limpar tudo</button>
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-2 gap-2 md:hidden">
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" className="h-11 justify-center font-bold">
                <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtrar
                {activeFilterCount > 0 ? <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{activeFilterCount}</span> : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="flex h-[90vh] flex-col rounded-t-2xl bg-white p-0">
              <SheetHeader className="border-b border-gray-100 px-5 py-4 text-left">
                <SheetTitle>Filtrar produtos</SheetTitle>
                <SheetDescription>As opções e contagens se ajustam ao que você já selecionou.</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {facets ? <ProductFilters facets={facets} search={search} /> : facetsLoading ? <FilterSkeleton /> : <p className="text-sm text-gray-500">Filtros temporariamente indisponíveis.</p>}
              </div>
              <div className="border-t border-gray-100 bg-white p-4">
                <SheetClose asChild><Button className="h-11 w-full bg-red-600 font-black text-white hover:bg-red-700">Ver {catalog?.total?.toLocaleString("pt-BR") ?? ""} produtos</Button></SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <label className="flex h-11 items-center rounded-md border border-gray-200 bg-white px-3">
            <span className="sr-only">Ordenar</span>
            <select value={search.sort ?? "newest"} onChange={(event) => updateSearch({ sort: event.target.value as CatalogSort })} className="h-full w-full bg-transparent text-xs font-bold text-gray-800 outline-none">
              <option value="newest">Mais recentes</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option><option value="name_asc">Nome A–Z</option><option value="name_desc">Nome Z–A</option>
            </select>
          </label>
        </div>

        <div className="flex gap-9">
          <aside className="hidden w-64 flex-shrink-0 md:block">
            <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-3">
              {facets ? <ProductFilters facets={facets} search={search} /> : facetsLoading ? <FilterSkeleton /> : facetsError ? <p className="text-sm text-gray-500">Filtros temporariamente indisponíveis.</p> : null}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {isFetching && !isLoading ? <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-gray-100" aria-label="Atualizando catálogo"><div className="h-full w-1/3 animate-pulse bg-red-600" /></div> : null}

            {isLoading ? (
              <CatalogProductGrid products={[]} isLoading />
            ) : products.length > 0 ? (
              <>
                <CatalogProductGrid products={products} isLoading={false} />
                {totalPages > 1 ? (
                  <nav className="mt-14 flex flex-wrap items-center justify-center gap-2" aria-label="Paginação do catálogo">
                    <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
                    {getVisiblePages(currentPage, totalPages).map((page, index, visiblePages) => {
                      const previous = visiblePages[index - 1];
                      const showGap = previous !== undefined && page - previous > 1;
                      return <React.Fragment key={page}>{showGap ? <span className="px-1 text-gray-400">…</span> : null}<Button type="button" variant={page === currentPage ? "default" : "outline"} size="sm" onClick={() => goToPage(page)} aria-current={page === currentPage ? "page" : undefined} className={page === currentPage ? "bg-red-600 text-white hover:bg-red-700" : undefined}>{page}</Button></React.Fragment>;
                    })}
                    <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
                  </nav>
                ) : null}
              </>
            ) : (
              <div className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100"><SlidersHorizontal className="h-7 w-7 text-gray-400" /></div>
                <h2 className="text-2xl font-black text-gray-950">Nenhum produto por aqui</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">Tente remover um filtro, usar uma busca mais curta ou explorar todo o catálogo.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {activeFilterCount > 0 ? <Button type="button" onClick={clearAllFilters} className="bg-red-600 text-white hover:bg-black">Limpar filtros</Button> : null}
                  <Button asChild variant="outline"><Link to="/products" search={{}}>Ver todo o catálogo</Link></Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
