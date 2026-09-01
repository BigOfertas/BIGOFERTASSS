import React, { useState } from "react";

import {
  useCatalogFacets,
  useCatalogProducts,
} from "@/hooks/useCatalogProducts";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";

const ShopByLeague: React.FC = () => {
  const { data: facets, isLoading: facetsLoading, error: facetsError } =
    useCatalogFacets();
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);

  const leagues = facets?.ligas ?? [];
  const activeLeague =
    selectedLeague && leagues.some((league) => league.value === selectedLeague)
      ? selectedLeague
      : (leagues[0]?.value ?? null);

  const { data, isLoading: productsLoading, error: productsError } =
    useCatalogProducts(
      activeLeague ? { liga: activeLeague, pageSize: 12 } : { pageSize: 12 },
    );

  const activeProducts = activeLeague ? (data?.items ?? []) : [];
  const isLoading = facetsLoading || productsLoading;
  const error = facetsError || productsError;

  if (error || (!isLoading && leagues.length === 0)) {
    return null;
  }

  return (
    <section className="overflow-hidden bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="mb-8 text-center text-xl font-black uppercase leading-none tracking-tighter text-gray-900 md:text-2xl">
          COMPRE POR <span className="text-red-600">LIGA</span>
        </h2>

        {facetsLoading ? (
          <div className="mx-auto mb-12 h-10 max-w-xl animate-pulse rounded bg-gray-100" />
        ) : (
          <div className="mb-12 flex flex-wrap justify-center gap-x-4 gap-y-3 md:gap-x-10">
            {leagues.map((league) => (
              <button
                type="button"
                key={league.value}
                onClick={() => setSelectedLeague(league.value)}
                className={`relative min-h-11 whitespace-nowrap px-4 py-2 text-base font-bold uppercase tracking-tight transition-all ${
                  activeLeague === league.value
                    ? "text-gray-900"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {league.label}
                {activeLeague === league.value ? (
                  <span className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-red-600" />
                ) : null}
              </button>
            ))}
          </div>
        )}

        {productsLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[4/5] animate-pulse rounded-md bg-gray-100"
              />
            ))}
          </div>
        ) : activeProducts.length > 0 ? (
          <ProductCarousel itemCount={activeProducts.length}>
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
          </ProductCarousel>
        ) : null}
      </div>
    </section>
  );
};

export default ShopByLeague;
