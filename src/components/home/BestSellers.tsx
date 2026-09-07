import React from "react";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";

const SHOWCASE_SIZE = 15;

const BestSellers: React.FC = () => {
  const { data, isLoading, error } = useCatalogProducts({
    pageSize: 24,
    sort: "newest",
  });

  const newestProducts = (data?.items ?? []).slice(0, SHOWCASE_SIZE);
  const placeholderCount = Math.max(0, SHOWCASE_SIZE - newestProducts.length);

  return (
    <section className="overflow-hidden bg-transparent py-9 sm:py-11 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-7 text-center sm:mb-8">
          <p className="display-kicker">Novidades da loja</p>
          <h2 className="display-title mt-2">Lançamentos</h2>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-2 py-4 shadow-sm sm:px-4 sm:py-5 lg:px-5">
          <ProductCarousel itemCount={SHOWCASE_SIZE}>
            {newestProducts.map((product) => (
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
            {Array.from({ length: placeholderCount }).map((_, index) => (
              <ProductCardPlaceholder key={`new-placeholder-${index}`} loading={isLoading} />
            ))}
          </ProductCarousel>
        </div>

        {error ? <span className="sr-only">Não foi possível carregar os lançamentos.</span> : null}
      </div>
    </section>
  );
};

export default BestSellers;
