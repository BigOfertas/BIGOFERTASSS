import React from "react";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";

const SHOWCASE_SIZE = 15;
const LOADING_SIZE = 5;

const BrazilianProducts: React.FC = () => {
  const { data, isLoading, error } = useCatalogProducts({
    campeonato: "brasileirao",
    pageSize: 24,
  });
  const brazilianProducts = (data?.items ?? []).slice(0, SHOWCASE_SIZE);

  if (!isLoading && brazilianProducts.length === 0) return null;

  const content = isLoading
    ? Array.from({ length: LOADING_SIZE }).map((_, index) => (
        <ProductCardPlaceholder key={`brasileirao-loading-${index}`} loading />
      ))
    : brazilianProducts.map((product) => (
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
      ));

  return (
    <section
      id="brasileirao"
      className="scroll-mt-28 overflow-hidden bg-transparent py-9 sm:py-11 lg:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-7 text-center sm:mb-8">
          <p className="display-kicker">Campeonato brasileiro</p>
          <h2 className="display-title-sm mt-2">Produtos do Brasileirão</h2>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-2 py-4 shadow-sm sm:px-4 sm:py-5 lg:px-5">
          <ProductCarousel itemCount={isLoading ? LOADING_SIZE : brazilianProducts.length}>
            {content}
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
