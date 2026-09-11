import React, { useEffect, useMemo, useRef, useState } from "react";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import type { CatalogListItem } from "@/lib/catalog";
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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

async function preloadProductImages(products: CatalogListItem[]) {
  const urls = [
    ...new Set(products.map((product) => product.displayImageUrl).filter((url): url is string => !!url)),
  ];
  if (urls.length === 0) return;

  const preload = Promise.allSettled(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = url;
          if (image.complete) resolve();
        }),
    ),
  );

  await Promise.race([preload, sleep(1800)]);
}

const ShopByLeague: React.FC = () => {
  const [activeLeagueId, setActiveLeagueId] = useState(DEFAULT_LEAGUE.id);
  const [displayLeagueId, setDisplayLeagueId] = useState(DEFAULT_LEAGUE.id);
  const [displayProducts, setDisplayProducts] = useState<CatalogListItem[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTokenRef = useRef(0);

  const activeLeague = LEAGUES.find((league) => league.id === activeLeagueId) ?? DEFAULT_LEAGUE;
  const torcedorQuery = useCatalogProducts({
    liga: activeLeague.slug,
    commercialType: "torcedor",
    pageSize: 48,
    sort: "newest",
  });
  const jogadorQuery = useCatalogProducts({
    liga: activeLeague.slug,
    commercialType: "jogador",
    pageSize: 48,
    sort: "newest",
  });

  const incomingProducts = useMemo(() => {
    const candidates = [...(torcedorQuery.data?.items ?? []), ...(jogadorQuery.data?.items ?? [])]
      .filter(isStandardHomeJersey)
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));

    return selectVariedProducts(candidates, SHOWCASE_SIZE);
  }, [jogadorQuery.data?.items, torcedorQuery.data?.items]);

  const incomingLoading =
    torcedorQuery.isLoading ||
    jogadorQuery.isLoading ||
    torcedorQuery.isFetching ||
    jogadorQuery.isFetching ||
    torcedorQuery.isPlaceholderData ||
    jogadorQuery.isPlaceholderData;
  const error = torcedorQuery.error ?? jogadorQuery.error;

  useEffect(() => {
    if (incomingLoading) return;
    if (displayLeagueId === activeLeague.id && displayProducts.length > 0) return;

    const token = ++transitionTokenRef.current;
    let cancelled = false;

    const commitLeague = async () => {
      await preloadProductImages(incomingProducts);
      if (cancelled || token !== transitionTokenRef.current) return;

      if (displayProducts.length > 0) {
        setIsTransitioning(true);
        await sleep(120);
      }
      if (cancelled || token !== transitionTokenRef.current) return;

      setDisplayLeagueId(activeLeague.id);
      setDisplayProducts(incomingProducts);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelled && token === transitionTokenRef.current) setIsTransitioning(false);
        });
      });
    };

    void commitLeague();
    return () => {
      cancelled = true;
    };
  }, [activeLeague.id, displayLeagueId, displayProducts.length, incomingLoading, incomingProducts]);

  const handleLeagueChange = (id: string) => {
    if (id === activeLeagueId) return;
    setActiveLeagueId(id);
  };

  const showInitialPlaceholders = displayProducts.length === 0;

  return (
    <section className="overflow-hidden bg-transparent py-9 sm:py-11 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-6 text-center sm:mb-8">
          <p className="display-kicker">Futebol internacional</p>
          <h2 className="display-title-sm mt-2">Compre por liga</h2>
        </div>

        <div className="mb-7 flex justify-center sm:mb-8">
          <div className="grid w-full max-w-md grid-cols-6 gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm sm:flex sm:w-auto sm:max-w-full">
            {LEAGUES.map((league, index) => (
              <button
                type="button"
                key={league.id}
                onClick={() => handleLeagueChange(league.id)}
                aria-pressed={activeLeagueId === league.id}
                className={`min-h-10 min-w-0 rounded-xl px-2 py-2 text-[11px] font-extrabold leading-tight tracking-[0.015em] transition-colors duration-200 motion-reduce:transition-none sm:whitespace-nowrap sm:px-4 sm:text-xs ${
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

        <div className="rounded-2xl border border-gray-200 bg-white px-2 py-4 shadow-sm sm:px-4 sm:py-5 lg:px-5">
          <div
            data-league-products={displayLeagueId}
            className={`relative transition-all duration-150 ease-out motion-reduce:transform-none motion-reduce:transition-none ${
              isTransitioning ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
            }`}
          >
            <ProductCarousel
              key={showInitialPlaceholders ? "league-loading" : displayLeagueId}
              itemCount={showInitialPlaceholders ? INITIAL_PLACEHOLDER_COUNT : displayProducts.length}
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
