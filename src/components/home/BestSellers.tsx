import React, { useState } from "react";

import ProductCardPlaceholder from "@/components/home/ProductCardPlaceholder";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";

const SHOWCASE_SIZE = 15;

type ShowcaseTab = "best" | "new";

const BestSellers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("best");
  const [displayTab, setDisplayTab] = useState<ShowcaseTab>("best");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { data, isLoading, error } = useCatalogProducts({
    pageSize: 24,
    sort: "newest",
  });

  const newestProducts = (data?.items ?? []).slice(0, SHOWCASE_SIZE);

  // O projeto ainda não possui uma métrica real de vendas/pedidos consolidada.
  // Mantemos a aba e sua composição visual prontas sem inventar um ranking.
  const bestSellingProducts = [] as typeof newestProducts;

  const visibleProducts =
    displayTab === "best" ? bestSellingProducts : newestProducts;
  const placeholderCount = Math.max(0, SHOWCASE_SIZE - visibleProducts.length);

  const handleTabChange = (tab: ShowcaseTab) => {
    if (tab === activeTab || isTransitioning) return;

    setIsTransitioning(true);
    setActiveTab(tab);

    window.setTimeout(() => {
      setDisplayTab(tab);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex justify-center items-center gap-6 md:gap-12 mb-12">
          <button
            type="button"
            onClick={() => handleTabChange("best")}
            aria-pressed={activeTab === "best"}
            className={`text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none transition-colors duration-200 relative ${
              activeTab === "best"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            MAIS{" "}
            <span className={activeTab === "best" ? "text-red-600" : ""}>
              VENDIDOS
            </span>
            {activeTab === "best" ? (
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-red-600 rounded-full" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("new")}
            aria-pressed={activeTab === "new"}
            className={`text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none transition-colors duration-200 relative ${
              activeTab === "new"
                ? "text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            LANÇAMENTOS
            {activeTab === "new" ? (
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-red-600 rounded-full" />
            ) : null}
          </button>
        </div>

        <div
          className={`relative transition-all duration-150 ease-in-out ${
            isTransitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
          }`}
        >
          <ProductCarousel key={displayTab} itemCount={SHOWCASE_SIZE}>
            {visibleProducts.map((product) => (
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
                key={`${displayTab}-placeholder-${index}`}
                loading={displayTab === "new" && isLoading}
              />
            ))}
          </ProductCarousel>
        </div>

        {displayTab === "best" ? (
          <span className="sr-only">
            A classificação real de mais vendidos será preenchida quando houver
            histórico de pedidos suficiente; nenhum ranking fictício é exibido.
          </span>
        ) : null}

        {error ? (
          <span className="sr-only">Não foi possível carregar os lançamentos.</span>
        ) : null}
      </div>
    </section>
  );
};

export default BestSellers;
