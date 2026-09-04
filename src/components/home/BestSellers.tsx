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

  // O projeto ainda não possui uma métrica consolidada de vendas suficiente
  // para ordenar produtos por volume sem inventar um ranking.
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
    <section className="overflow-hidden bg-transparent py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-8 flex flex-col items-center gap-5 text-center sm:mb-10">
          <div>
            <p className="display-kicker">Seleção da loja</p>
            <h2 className="display-title mt-2">Destaques para começar</h2>
          </div>

          <div className="glass-card inline-flex rounded-2xl p-1.5">
            <button
              type="button"
              onClick={() => handleTabChange("best")}
              aria-pressed={activeTab === "best"}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold tracking-[-0.015em] transition-colors duration-200 motion-reduce:transition-none sm:px-5 sm:text-sm ${
                activeTab === "best"
                  ? "bg-gray-950 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Mais vendidos
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("new")}
              aria-pressed={activeTab === "new"}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold tracking-[-0.015em] transition-colors duration-200 motion-reduce:transition-none sm:px-5 sm:text-sm ${
                activeTab === "new"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Lançamentos
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-[1.75rem] px-2 py-4 sm:px-4 sm:py-5 lg:px-5">
          <div
            className={`relative transition-all duration-150 ease-in-out motion-reduce:transform-none motion-reduce:transition-none ${
              isTransitioning ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"
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
        </div>

        {error ? (
          <span className="sr-only">Não foi possível carregar os lançamentos.</span>
        ) : null}
      </div>
    </section>
  );
};

export default BestSellers;
