import { useQueries } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { catalogProductsQueryOptions } from "@/hooks/useCatalogProducts";
import { isStandardHomeJersey, selectVariedProducts } from "@/lib/home-product-selection";

interface League {
  id: string;
  name: string;
  slug: string;
}

const LEAGUES: League[] = [
  { id: "la-liga", name: "LA LIGA", slug: "la-liga" },
  { id: "premier-league", name: "PREMIER LEAGUE", slug: "premier-league" },
  { id: "serie-a", name: "SERIE A", slug: "serie-a" },
  { id: "bundesliga", name: "BUNDESLIGA", slug: "bundesliga" },
  { id: "ligue-1", name: "LIGUE 1", slug: "ligue-1" },
];

const SHOWCASE_SIZE = 15;
const INITIAL_PLACEHOLDER_COUNT = 5;
const DEFAULT_LEAGUE = LEAGUES[0]!;

const ShopByLeague: React.FC = () => {
  const [activeLeagueId, setActiveLeagueId] = useState(DEFAULT_LEAGUE.id);

  const leagueQueryOptions = useMemo(
    () =>
      LEAGUES.flatMap((league) => [
        catalogProductsQueryOptions({
          liga: league.slug,
          commercialType: "torcedor",
          pageSize: 48,
          sort: "featured",
        }),
        catalogProductsQueryOptions({
          liga: league.slug,
          commercialType: "jogador",
          pageSize: 48,
          sort: "featured",
        }),
      ]),
    [],
  );

  // Todas as ligas começam a carregar juntas assim que a home monta. Como a
  // primeira pintura fica coberta pelo splash inicial, o cache normalmente já
  // está quente quando o cliente interage com os botões. Depois disso, trocar
  // de liga é apenas trocar o índice dos dados já presentes no React Query.
  const leagueQueries = useQueries({ queries: leagueQueryOptions });

  const activeLeagueIndex = Math.max(
    0,
    LEAGUES.findIndex((league) => league.id === activeLeagueId),
  );
  const activeLeague = LEAGUES[activeLeagueIndex] ?? DEFAULT_LEAGUE;
  const torcedorQuery = leagueQueries[activeLeagueIndex * 2];
  const jogadorQuery = leagueQueries[activeLeagueIndex * 2 + 1];

  const displayProducts = useMemo(() => {
    const candidates = [
      ...(torcedorQuery?.data?.items ?? []),
      ...(jogadorQuery?.data?.items ?? []),
    ].filter(isStandardHomeJersey);

    return selectVariedProducts(candidates, SHOWCASE_SIZE);
  }, [jogadorQuery?.data?.items, torcedorQuery?.data?.items]);

  const activeDataReady = Boolean(torcedorQuery?.data && jogadorQuery?.data);
  const showInitialPlaceholders = !activeDataReady;
  const error = torcedorQuery?.error ?? jogadorQuery?.error;

  const handleLeagueChange = (id: string) => {
    if (id === activeLeagueId) return;
    setActiveLeagueId(id);
  };

  return (
    <section className="overflow-hidden bg-transparent py-9 sm:py-11 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 lg:max-w-[1536px] lg:px-4">
        <div className="mb-6 text-center sm:mb-8">
          <p className="display-kicker">Futebol internacional</p>
          <h2 className="display-title-sm mt-2">Compre por liga</h2>
        </div>

        <div className="mb-7 flex justify-center sm:mb-8">
          <div className="league-switcher grid w-full max-w-md grid-cols-6 gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm sm:flex sm:w-auto sm:max-w-full">
            {LEAGUES.map((league, index) => (
              <button
                type="button"
                key={league.id}
                onClick={() => handleLeagueChange(league.id)}
                aria-pressed={activeLeagueId === league.id}
                className={`min-h-10 min-w-0 rounded-xl px-2 py-2 text-[11px] font-extrabold leading-tight tracking-[0.015em] transition-colors duration-150 motion-reduce:transition-none sm:whitespace-nowrap sm:px-4 sm:text-xs ${
                  index < 3 ? "col-span-2" : "col-span-3"
                } ${
                  activeLeagueId === league.id
                    ? "bg-gray-950 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {league.name}
              </button>
            ))}
          </div>
        </div>

        <div className="storefront-showcase rounded-2xl border border-gray-200 bg-white px-2 py-4 shadow-sm sm:px-4 sm:py-5 lg:px-5">
          <div data-league-products={activeLeague.id} className="relative">
            <ProductCarousel
              key={showInitialPlaceholders ? `league-loading-${activeLeague.id}` : activeLeague.id}
              itemCount={
                showInitialPlaceholders ? INITIAL_PLACEHOLDER_COUNT : displayProducts.length
              }
            >
              {displayProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  slug={product.slug}
                  name={product.name}
                  price={product.price}
                  promotionalPrice={product.promotional_price}
                  imageUrl={product.displayImageUrl}
                  time={product.time}
                  commercialType={product.commercial_type}
                />
              ))}
              {showInitialPlaceholders
                ? Array.from({ length: INITIAL_PLACEHOLDER_COUNT }).map((_, index) => (
                    <ProductCardPlaceholder key={`league-placeholder-${index}`} loading />
                  ))
                : null}
            </ProductCarousel>
          </div>
        </div>

        {error ? (
          <span className="sr-only">
            Não foi possível carregar os produtos da liga selecionada.
          </span>
        ) : null}
      </div>
    </section>
  );
};

export default ShopByLeague;
