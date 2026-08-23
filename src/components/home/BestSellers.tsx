import React, { useState, useEffect } from "react";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";

// Mock data conforme solicitado - 15 produtos por categoria
const MOCK_BEST_SELLERS = Array.from({ length: 15 }, (_, i) => ({
  id: `best-${i + 1}`,
  name: `Produto Mais Vendido ${i + 1} - Camisa Profissional`,
  price: 349.99 + (i * 10),
}));

const MOCK_NEW_ARRIVALS = Array.from({ length: 15 }, (_, i) => ({
  id: `new-${i + 1}`,
  name: `Lançamento ${i + 1} - Nova Coleção 2024`,
  price: 399.99 - (i * 5),
}));

const BestSellers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"best" | "new">("best");
  const [displayTab, setDisplayTab] = useState<"best" | "new">("best");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleTabChange = (tab: "best" | "new") => {
    if (tab === activeTab || isTransitioning) return;
    
    setIsTransitioning(true);
    setActiveTab(tab);
    
    // Fade out (150ms) -> Switch data -> Fade in (150ms)
    setTimeout(() => {
      setDisplayTab(tab);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Títulos das Abas Centralizados */}
        <div className="flex justify-center items-center gap-6 md:gap-12 mb-12">
          <button
            onClick={() => handleTabChange("best")}
            className={`text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none transition-all relative ${
              activeTab === "best" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            MAIS <span className={activeTab === "best" ? "text-red-600" : ""}>VENDIDOS</span>
            {activeTab === "best" && (
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-red-600 rounded-full"></span>
            )}
          </button>
          
          <button
            onClick={() => handleTabChange("new")}
            className={`text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none transition-all relative ${
              activeTab === "new" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            LANÇAMENTOS
            {activeTab === "new" && (
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-red-600 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Seção de Produtos com Crossfade e Paginação Independente */}
        <div 
          className={`relative transition-opacity duration-150 ease-in-out ${
            isTransitioning ? "opacity-0" : "opacity-100"
          }`}
        >
          {displayTab === "best" && (
            <div>
              <ProductCarousel itemCount={MOCK_BEST_SELLERS.length}>
                {MOCK_BEST_SELLERS.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                  />
                ))}
              </ProductCarousel>
            </div>
          )}

          {displayTab === "new" && (
            <div>
              <ProductCarousel itemCount={MOCK_NEW_ARRIVALS.length}>
                {MOCK_NEW_ARRIVALS.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                  />
                ))}
              </ProductCarousel>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default BestSellers;