import React from "react";

import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";

const BrazilianProducts: React.FC = () => {
  const { data, isLoading, error } = useCatalogProducts({
    campeonato: "brasileirao",
    pageSize: 12,
  });
  const brazilianProducts = data?.items ?? [];

  if (error || (!isLoading && brazilianProducts.length === 0)) {
    return null;
  }

  return (
    <section className="overflow-hidden bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="mb-12 text-center text-xl font-black uppercase leading-none tracking-tighter text-gray-900 md:text-2xl">
          PRODUTOS DO <span className="text-red-600">BRASILEIRÃO</span>
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[4/5] animate-pulse rounded-md bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <ProductCarousel itemCount={brazilianProducts.length}>
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
          </ProductCarousel>
        )}
      </div>
    </section>
  );
};

export default BrazilianProducts;
