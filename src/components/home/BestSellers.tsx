import React from "react";
import { useQuery } from "@tanstack/react-query";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { fetchHomeLaunchProducts } from "@/lib/home-launches";
import type { CatalogPage } from "@/lib/catalog";

const SHOWCASE_SIZE = 10;
const LOADING_SIZE = 5;
const PRIORITY_IMAGE_COUNT = 1;

interface BestSellersProps {
  initialData?: CatalogPage;
}

const BestSellers: React.FC<BestSellersProps> = ({ initialData }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["home", "launches", "top-10"],
    staleTime: 5 * 60_000,
    queryFn: fetchHomeLaunchProducts,
    initialData,
    initialDataUpdatedAt: initialData ? 0 : undefined,
  });
  const launchProducts = (data?.items ?? []).slice(0, SHOWCASE_SIZE);

  if (!isLoading && launchProducts.length === 0) return null;

  const content = isLoading
    ? Array.from({ length: LOADING_SIZE }).map((_, index) => (
        <ProductCardPlaceholder key={`launch-loading-${index}`} loading />
      ))
    : launchProducts.map((product, index) => (
        <ProductCard
          key={product.id}
          id={product.id}
          slug={product.slug}
          name={product.name}
          price={product.price}
          promotionalPrice={product.promotional_price}
          imageUrl={product.displayImageUrl}
          imageSrcSet={product.displayImageSrcSet}
          time={product.time}
          commercialType={product.commercial_type}
          priority={index < PRIORITY_IMAGE_COUNT}
        />
      ));

  return (
    <section
      id="lancamentos"
      className="scroll-mt-40 overflow-hidden bg-transparent py-9 sm:py-11 lg:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-7 text-center sm:mb-8">
          <p className="display-kicker">Novidades da loja</p>
          <h2 className="display-title mt-2">Lançamentos</h2>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-2 py-4 shadow-sm sm:px-4 sm:py-5 lg:px-5">
          <ProductCarousel itemCount={isLoading ? LOADING_SIZE : launchProducts.length}>
            {content}
          </ProductCarousel>
        </div>
        {error ? <span className="sr-only">Não foi possível carregar os lançamentos.</span> : null}
      </div>
    </section>
  );
};

export default BestSellers;
