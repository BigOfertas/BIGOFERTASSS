import React from "react";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";

const SHOWCASE_SIZE = 15;

const BrazilianProducts: React.FC = () => {
  const { data, isLoading, error } = useCatalogProducts({
    campeonato: "brasileirao",
    pageSize: 12,
  });
  const brazilianProducts = data?.items ?? [];
  const placeholderCount = Math.max(0, SHOWCASE_SIZE - brazilianProducts.length);

  return (
    <section className="overflow-hidden bg-transparent py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <p className="display-kicker">Campeonato brasileiro</p>
          <h2 className="display-title-sm mt-2">Produtos do Brasileirão</h2>
        </div>

        <div className="glass-panel rounded-[1.75rem] px-2 py-4 sm:px-4 sm:py-5 lg:px-5">
          <div className="relative">
            <ProductCarousel itemCount={SHOWCASE_SIZE}>
              {brazilianProducts.map((product) => (
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
                  key={`brasileirao-placeholder-${index}`}
                  loading={isLoading}
                />
              ))}
            </ProductCarousel>
          </div>
        </div>

        {error ? (
          <span className="sr-only">Não foi possível carregar os produtos do Brasileirão.</span>
        ) : null}
      </div>
    </section>
  );
};

export default BrazilianProducts;
