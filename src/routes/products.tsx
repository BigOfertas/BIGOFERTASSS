import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { z } from "zod";

import ProductFilters from "@/components/ProductFilters";
import Header from "@/components/layout/Header";
import { CatalogProductGrid } from "@/components/product/CatalogProductGrid";
import { Button } from "@/components/ui/button";
import DirectionalReveal from "@/components/ui/directional-reveal";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import SlideUpReveal from "@/components/ui/slide-up-reveal";
import { useCatalogFacets, useCatalogProducts } from "@/hooks/useCatalogProducts";
import { LOCALE_META, useI18n } from "@/i18n";
import { uiCopy } from "@/i18n/ui-copy";
import {
  catalogSortSchema,
  countActiveCatalogFilters,
  type CatalogQuery,
  type CatalogSort,
} from "@/lib/catalog";
import { toCatalogFilterKey } from "@/lib/catalog-filter-key";
import { buildPageHead } from "@/lib/page-seo";

const filterKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .transform(toCatalogFilterKey)
  .pipe(
    z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  );

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
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: "Faixa de preço inválida" },
  )
  .catch({});

export const Route = createFileRoute("/products")({
  validateSearch: (search) => productSearchSchema.parse(search),
  head: () =>
    buildPageHead({
      title: "Produtos",
      description:
        "Explore o catálogo DropBox com camisas de futebol, retrô, seleções, kits de treino, corta-ventos e outros artigos esportivos.",
      path: "/products",
    }),
  component: ProductsPage,
});

function getVisiblePages(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= total)
    .sort((left, right) => left - right);
}

function FilterSkeleton() {
  const { translateText } = useI18n();
  return (
    <div className="space-y-8" aria-label={translateText("Carregando filtros")}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="mb-4 h-4 w-24 bg-gray-100" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((__, item) => (
              <div key={item} className="h-3 w-32 bg-gray-50" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductsPage() {
  const search = Route.useSearch() satisfies CatalogQuery;
  const navigate = useNavigate();
  const { locale, translateText } = useI18n();
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const { data: catalog, isLoading, isFetching, error } = useCatalogProducts(search);
  const { data: facets, isLoading: facetsLoading, error: facetsError } = useCatalogFacets(search);

  const currentPage = catalog?.page ?? search.page ?? 1;
  const totalPages = catalog?.totalPages ?? 0;
  const products = catalog?.items ?? [];
  const activeFilterCount = countActiveCatalogFilters(search);
  const numberLocale = LOCALE_META[locale].htmlLang;

  const updateSearch = (updates: CatalogQuery, resetPage = true) => {
    const next: CatalogQuery = { ...search, ...updates };
    if (resetPage) delete next.page;
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
              {translateText("Erro ao carregar produtos")}
            </h2>
            <p className="text-gray-600">
              {translateText("Não foi possível consultar o catálogo agora. Tente novamente mais tarde.")}
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
        <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900 md:text-3xl">
              <SlideUpReveal
                split="characters"
                stagger={0.032}
                inView
                className="justify-start"
                charClass="pb-[0.08em]"
              >
                {uiCopy(locale, "Produtos")}
              </SlideUpReveal>
            </h1>
            {search.q ? (
              <p className="mt-2 text-sm text-gray-500">
                <DirectionalReveal direction="left" distance={10} delay={0.08}>
                  {translateText("Resultados para")} <strong>“{search.q}”</strong>
                </DirectionalReveal>
              </p>
            ) : null}
            {!isLoading && catalog ? (
              <p className="mt-1 text-xs text-gray-400">
                <DirectionalReveal direction="left" distance={8} delay={0.12}>
                  {catalog.total.toLocaleString(numberLocale)} {translateText("produto(s) encontrado(s)")}
                </DirectionalReveal>
              </p>
            ) : null}
          </div>

          <DirectionalReveal direction="right" distance={10} delay={0.08}>
            <label className="hidden items-center gap-2 text-xs font-bold uppercase text-gray-500 md:flex">
              {uiCopy(locale, "Ordenar")}
              <select
                value={search.sort ?? "featured"}
                onChange={(event) => updateSearch({ sort: event.target.value as CatalogSort })}
                className="h-10 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900"
              >
                <option value="featured">{uiCopy(locale, "Destaques")}</option>
                <option value="newest">{uiCopy(locale, "Mais recentes")}</option>
                <option value="price_asc">{uiCopy(locale, "Menor preço")}</option>
                <option value="price_desc">{uiCopy(locale, "Maior preço")}</option>
                <option value="name_asc">{uiCopy(locale, "Nome A–Z")}</option>
                <option value="name_desc">{uiCopy(locale, "Nome Z–A")}</option>
              </select>
            </label>
          </DirectionalReveal>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 md:hidden">
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" className="h-11 justify-center font-bold">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {uiCopy(locale, "Filtrar")}
                {activeFilterCount > 0 ? (
                  <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="flex h-[90vh] flex-col rounded-t-2xl bg-white p-0"
            >
              <SheetHeader className="border-b border-gray-100 px-5 py-4 text-left">
                <SheetTitle>{uiCopy(locale, "Filtrar produtos")}</SheetTitle>
                <SheetDescription>
                  {translateText("As opções se ajustam ao que você já selecionou.")}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                {facets ? (
                  <ProductFilters facets={facets} search={search} />
                ) : facetsLoading ? (
                  <FilterSkeleton />
                ) : (
                  <p className="text-sm text-gray-500">
                    {translateText("Filtros temporariamente indisponíveis.")}
                  </p>
                )}
              </div>
              <div className="border-t border-gray-100 bg-white p-4">
                <SheetClose asChild>
                  <Button className="h-11 w-full bg-red-600 font-black text-white hover:bg-red-700">
                    {translateText("Ver")} {catalog?.total?.toLocaleString(numberLocale) ?? ""}{" "}
                    {translateText("produtos")}
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <label className="flex h-11 items-center rounded-md border border-gray-200 bg-white px-3">
            <span className="sr-only">{uiCopy(locale, "Ordenar")}</span>
            <select
              value={search.sort ?? "featured"}
              onChange={(event) => updateSearch({ sort: event.target.value as CatalogSort })}
              className="h-full w-full bg-transparent text-xs font-bold text-gray-800 outline-none"
            >
              <option value="featured">{uiCopy(locale, "Destaques")}</option>
              <option value="newest">{uiCopy(locale, "Mais recentes")}</option>
              <option value="price_asc">{uiCopy(locale, "Menor preço")}</option>
              <option value="price_desc">{uiCopy(locale, "Maior preço")}</option>
              <option value="name_asc">{uiCopy(locale, "Nome A–Z")}</option>
              <option value="name_desc">{uiCopy(locale, "Nome Z–A")}</option>
            </select>
          </label>
        </div>

        <div className="flex gap-8">
          <aside className="hidden w-64 flex-shrink-0 md:block">
            <div className="sticky top-24">
              {facets ? (
                <ProductFilters facets={facets} search={search} />
              ) : facetsLoading ? (
                <FilterSkeleton />
              ) : facetsError ? (
                <p className="text-sm text-gray-500">
                  {translateText("Filtros temporariamente indisponíveis.")}
                </p>
              ) : null}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {isFetching && !isLoading ? (
              <div
                className="mb-4 h-1 w-full overflow-hidden rounded-full bg-gray-100"
                aria-label={translateText("Atualizando catálogo")}
              >
                <div className="h-full w-1/3 animate-pulse bg-red-600" />
              </div>
            ) : null}

            {isLoading ? (
              <CatalogProductGrid products={[]} isLoading />
            ) : products.length > 0 ? (
              <>
                <CatalogProductGrid products={products} isLoading={false} />
                {totalPages > 1 ? (
                  <nav
                    className="mt-12 flex flex-wrap items-center justify-center gap-2"
                    aria-label={translateText("Paginação do catálogo")}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => goToPage(currentPage - 1)}
                      aria-label={translateText("Página anterior")}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {getVisiblePages(currentPage, totalPages).map((page, index, visiblePages) => {
                      const previous = visiblePages[index - 1];
                      const showGap = previous !== undefined && page - previous > 1;
                      return (
                        <React.Fragment key={page}>
                          {showGap ? <span className="px-1 text-gray-400">…</span> : null}
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
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => goToPage(currentPage + 1)}
                      aria-label={translateText("Próxima página")}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </nav>
                ) : null}
              </>
            ) : (
              <div className="py-20 text-center">
                <h2 className="text-xl font-bold uppercase text-gray-400">
                  <SlideUpReveal split="words" stagger={0.05} inView className="justify-center">
                    {uiCopy(locale, "Nenhum produto encontrado")}
                  </SlideUpReveal>
                </h2>
                <p className="mt-2 text-gray-500">
                  <DirectionalReveal direction="up" distance={8} delay={0.08}>
                    {translateText("Ajuste a busca ou os filtros para tentar novamente.")}
                  </DirectionalReveal>
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
