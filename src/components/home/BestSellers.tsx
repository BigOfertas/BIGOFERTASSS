import React from "react";

import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";

const SHOWCASE_SIZE = 15;

const BestSellers: React.FC = () => {
  const { data, isLoading, error } = useCatalogProducts({ pageSize: 12 });
  const recentProducts = data?.items ?? [];
  const placeholderCount = Math.max(0, SHOWCASE_SIZE - recentProducts.length);

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex justify-center items-center gap-6 md:gap-12 mb-12">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Disponível quando houver histórico real de vendas"
            className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none transition-all relative text-gray-400 cursor-default"
          >
            MAIS VENDIDOS
          </button>

          <button
            type="button"
            aria-current="true"
            className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none transition-all relative text-gray-900 cursor-default"
          >
            LANÇAMENTOS
            <span className="absolute -bottom-2 left-0 w-full h-1 bg-red-600 rounded-full" />
          </button>
        </div>

        <div className="relative transition-opacity duration-150 ease-in-out opacity-100">
          <ProductCarousel itemCount={SHOWCASE_SIZE}>
            {recentProducts.map((product) => (
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
                key={`recent-placeholder-${index}`}
                loading={isLoading}
              />
            ))}
          </ProductCarousel>
        </div>

        {error ? (
          <span className="sr-only">Não foi possível carregar os produtos recentes.</span>
        ) : null}
      </div>
    </section>
  );
};

export default BestSellers;
