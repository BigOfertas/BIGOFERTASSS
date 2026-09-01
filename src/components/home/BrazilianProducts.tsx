import React from "react";

import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";

const SHOWCASE_SIZE = 15;

const BrazilianProducts: React.FC = () => {
  const { data, isLoading, error } = useCatalogProducts({
    campeonato: "brasileirao",
    pageSize: 12,
  });
  const brazilianProducts = data?.items ?? [];
  const placeholderCount = Math.max(0, SHOWCASE_SIZE - brazilianProducts.length);

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-12 text-center text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none text-gray-900">
          PRODUTOS DO <span className="text-red-600">BRASILEIRÃO</span>
        </h2>

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

        {error ? (
          <span className="sr-only">Não foi possível carregar os produtos do Brasileirão.</span>
        ) : null}
      </div>
    </section>
  );
};

export default BrazilianProducts;
