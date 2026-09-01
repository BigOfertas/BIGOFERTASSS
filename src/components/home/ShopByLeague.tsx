import React, { useEffect, useState } from "react";

import {
  useCatalogFacets,
  useCatalogProducts,
} from "@/hooks/useCatalogProducts";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";

const SHOWCASE_SIZE = 15;
const TAB_PLACEHOLDERS = ["w-20", "w-32", "w-20", "w-28", "w-20"];

const ShopByLeague: React.FC = () => {
  const { data: facets, isLoading: facetsLoading, error: facetsError } =
    useCatalogFacets();
  const leagues = facets?.ligas ?? [];

  const [activeLeagueId, setActiveLeagueId] = useState<string>("");
  const [displayLeagueId, setDisplayLeagueId] = useState<string>("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (leagues.length === 0) {
      return;
    }

    const firstLeague = leagues[0]?.value ?? "";
    const activeStillExists = leagues.some(
      (league) => league.value === activeLeagueId,
    );
    const displayStillExists = leagues.some(
      (league) => league.value === displayLeagueId,
    );

    if (!activeStillExists) {
      setActiveLeagueId(firstLeague);
    }
    if (!displayStillExists) {
      setDisplayLeagueId(firstLeague);
    }
  }, [leagues, activeLeagueId, displayLeagueId]);

  const { data, isLoading: productsLoading, error: productsError } =
    useCatalogProducts(
      displayLeagueId
        ? { liga: displayLeagueId, pageSize: 12 }
        : { pageSize: 12 },
    );

  const activeProducts = displayLeagueId ? (data?.items ?? []) : [];
  const placeholderCount = Math.max(0, SHOWCASE_SIZE - activeProducts.length);
  const isLoading = facetsLoading || productsLoading;
  const error = facetsError || productsError;

  const handleLeagueChange = (id: string) => {
    if (id === activeLeagueId || isTransitioning) {
      return;
    }

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

        {leagues.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-x-4 md:gap-x-10 gap-y-3 mb-12">
            {leagues.map((league) => (
              <button
                type="button"
                key={league.value}
                onClick={() => handleLeagueChange(league.value)}
                className={`whitespace-nowrap text-base font-bold tracking-tight uppercase transition-all relative px-4 py-2 min-h-[44px] ${
                  activeLeagueId === league.value
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {league.label}
                {activeLeagueId === league.value ? (
                  <span className="absolute bottom-0 left-0 w-full h-[3px] bg-red-600 rounded-full transition-all duration-200 ease-in-out" />
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="flex flex-wrap justify-center gap-x-4 md:gap-x-10 gap-y-3 mb-12"
          >
            {TAB_PLACEHOLDERS.map((width, index) => (
              <div
                key={index}
                className={`h-11 ${width} rounded bg-gray-100 ${
                  facetsLoading ? "animate-pulse" : ""
                }`}
              />
            ))}
          </div>
        )}

        <div
          className={`relative transition-opacity duration-150 ease-in-out ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          <ProductCarousel itemCount={SHOWCASE_SIZE}>
            {activeProducts.map((product) => (
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
                key={`league-placeholder-${index}`}
                loading={isLoading}
              />
            ))}
          </ProductCarousel>
        </div>

        {error ? (
          <span className="sr-only">Não foi possível carregar as ligas do catálogo.</span>
        ) : null}
      </div>
    </section>
  );
};

export default ShopByLeague;
