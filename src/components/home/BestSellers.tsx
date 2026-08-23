import React, { useState } from "react";
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
  // Removido o estado currentPage daqui para deixar interno no ProductCarousel
  // ou permitir que cada aba tenha o seu.

  const products = activeTab === "best" ? MOCK_BEST_SELLERS : MOCK_NEW_ARRIVALS;

  const handleTabChange = (tab: "best" | "new") => {
    setActiveTab(tab);
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
            LANÇA<span className={activeTab === "new" ? "text-red-600" : ""}>MENTOS</span>
            {activeTab === "new" && (
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-red-600 rounded-full"></span>
            )}
          </button>
        </div>

        {/* Seção de Produtos com Crossfade e Paginação Independente */}
        <div className="relative">
          {activeTab === "best" ? (
            <div className="animate-in fade-in duration-300">
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
          ) : (
            <div className="animate-in fade-in duration-300">
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