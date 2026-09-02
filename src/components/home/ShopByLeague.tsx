import React, { useState } from "react";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";

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
const DEFAULT_LEAGUE = LEAGUES[0]!;

const ShopByLeague: React.FC = () => {
  const [activeLeagueId, setActiveLeagueId] = useState(DEFAULT_LEAGUE.id);
  const [displayLeagueId, setDisplayLeagueId] = useState(DEFAULT_LEAGUE.id);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const displayLeague =
    LEAGUES.find((league) => league.id === displayLeagueId) ?? DEFAULT_LEAGUE;

  const { data, isLoading, error } = useCatalogProducts({
    liga: displayLeague.slug,
    pageSize: 24,
    sort: "newest",
  });

  const products = (data?.items ?? []).slice(0, SHOWCASE_SIZE);
  const placeholderCount = Math.max(0, SHOWCASE_SIZE - products.length);

  const handleLeagueChange = (id: string) => {
    if (id === activeLeagueId || isTransitioning) return;

    setIsTransitioning(true);
    setActiveLeagueId(id);

    window.setTimeout(() => {
      setDisplayLeagueId(id);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-8 text-center text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none text-gray-900">
          COMPRE POR <span className="text-red-600">LIGA</span>
        </h2>

        <div className="flex flex-wrap justify-center gap-x-4 md:gap-x-10 gap-y-3 mb-12">
          {LEAGUES.map((league) => (
            <button
              type="button"
              key={league.id}
              onClick={() => handleLeagueChange(league.id)}
              aria-pressed={activeLeagueId === league.id}
              className={`whitespace-nowrap text-base font-bold tracking-tight uppercase transition-colors duration-200 relative px-4 py-2 min-h-[44px] ${
                activeLeagueId === league.id
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {league.name}
              {activeLeagueId === league.id ? (
                <span className="absolute bottom-0 left-0 w-full h-[3px] bg-red-600 rounded-full transition-all duration-200 ease-in-out" />
              ) : null}
            </button>
          ))}
        </div>

        <div
          className={`relative transition-all duration-150 ease-in-out ${
            isTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
          }`}
        >
          <ProductCarousel key={displayLeagueId} itemCount={SHOWCASE_SIZE}>
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
            {Array.from({ length: placeholderCount }).map((_, index) => (
              <ProductCardPlaceholder
                key={`${displayLeagueId}-placeholder-${index}`}
                loading={isLoading}
              />
            ))}
          </ProductCarousel>
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
