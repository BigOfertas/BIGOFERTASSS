import React, { useMemo } from "react";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { isStandardHomeJersey, selectVariedProducts } from "@/lib/home-product-selection";

const SHOWCASE_SIZE = 15;
const LOADING_SIZE = 5;

const BrazilianProducts: React.FC = () => {
  const championshipTorcedorQuery = useCatalogProducts({
    campeonato: "brasileirao",
    commercialType: "torcedor",
    pageSize: 48,
    sort: "featured",
  });
  const championshipJogadorQuery = useCatalogProducts({
    campeonato: "brasileirao",
    commercialType: "jogador",
    pageSize: 48,
    sort: "featured",
  });
  const legacyTorcedorQuery = useCatalogProducts({
    liga: "brasileirao",
    commercialType: "torcedor",
    pageSize: 48,
    sort: "featured",
  });
  const legacyJogadorQuery = useCatalogProducts({
    liga: "brasileirao",
    commercialType: "jogador",
    pageSize: 48,
    sort: "featured",
  });

  const brazilianProducts = useMemo(() => {
    const candidates = [
      ...(championshipTorcedorQuery.data?.items ?? []),
      ...(championshipJogadorQuery.data?.items ?? []),
      ...(legacyTorcedorQuery.data?.items ?? []),
      ...(legacyJogadorQuery.data?.items ?? []),
    ].filter(isStandardHomeJersey);

    return selectVariedProducts(candidates, SHOWCASE_SIZE);
  }, [
    championshipJogadorQuery.data?.items,
    championshipTorcedorQuery.data?.items,
    legacyJogadorQuery.data?.items,
    legacyTorcedorQuery.data?.items,
  ]);

  const isLoading =
    championshipTorcedorQuery.isLoading ||
    championshipJogadorQuery.isLoading ||
    legacyTorcedorQuery.isLoading ||
    legacyJogadorQuery.isLoading;
  const error =
    championshipTorcedorQuery.error ??
    championshipJogadorQuery.error ??
    legacyTorcedorQuery.error ??
    legacyJogadorQuery.error;

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
    <div
      id="brasileirao"
      className="mt-6 scroll-mt-28 rounded-2xl border border-gray-200 bg-white px-2 py-4 shadow-sm sm:px-4 sm:py-5 lg:px-5"
    >
      <ProductCarousel itemCount={isLoading ? LOADING_SIZE : brazilianProducts.length}>
        {content}
      </ProductCarousel>
      {error ? (
        <span className="sr-only">Não foi possível carregar os produtos do Brasileirão.</span>
      ) : null}
    </div>
  );
};

export default BrazilianProducts;
