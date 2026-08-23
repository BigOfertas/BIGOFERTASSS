import React, { useState } from "react";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";

// Mock data conforme solicitado
const MOCK_BEST_SELLERS = [
  { id: "1", name: "Camisa Brasil I 2024 - Torcedor Nike Masculina", price: 349.99 },
  { id: "2", name: "Camisa Real Madrid Home 24/25 - Adidas Masculina", price: 399.99 },
  { id: "3", name: "Camisa Argentina I 2024 - Campeão do Mundo Masculina", price: 349.99 },
  { id: "4", name: "Camisa Portugal Home 24/25 Nike Masculina", price: 349.99 },
  { id: "5", name: "Camisa Manchester City Home 24/25 Puma Masculina", price: 399.99 },
  { id: "6", name: "Camisa Flamengo Home 2024 Adidas Masculina", price: 349.99 },
  { id: "7", name: "Camisa Palmeiras Home 2024 Puma Masculina", price: 349.99 },
  { id: "8", name: "Camisa São Paulo Home 2024 New Balance Masculina", price: 349.99 },
  { id: "9", name: "Camisa Liverpool Home 24/25 Nike Masculina", price: 399.99 },
  { id: "10", name: "Camisa Barcelona Home 24/25 Nike Masculina", price: 399.99 },
];

const MOCK_NEW_ARRIVALS = [
  { id: "11", name: "Camisa Inter de Milão Home 24/25 Nike Masculina", price: 399.99 },
  { id: "12", name: "Camisa Bayern de Munique Home 24/25 Adidas Masculina", price: 399.99 },
  { id: "13", name: "Camisa Chelsea Home 24/25 Nike Masculina", price: 399.99 },
  { id: "14", name: "Camisa Juventus Home 24/25 Adidas Masculina", price: 399.99 },
  { id: "15", name: "Camisa Arsenal Home 24/25 Adidas Masculina", price: 399.99 },
  { id: "16", name: "Camisa Milan Home 24/25 Puma Masculina", price: 399.99 },
  { id: "17", name: "Camisa PSG Home 24/25 Nike Masculina", price: 399.99 },
  { id: "18", name: "Camisa Tottenham Home 24/25 Nike Masculina", price: 399.99 },
  { id: "19", name: "Camisa Borussia Dortmund Home 24/25 Puma Masculina", price: 399.99 },
  { id: "20", name: "Camisa Manchester United Home 24/25 Adidas Masculina", price: 399.99 },
];

const BestSellers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"best" | "new">("best");
  const [currentPage, setCurrentPage] = useState(0);

  const products = activeTab === "best" ? MOCK_BEST_SELLERS : MOCK_NEW_ARRIVALS;

  const handleTabChange = (tab: "best" | "new") => {
    setActiveTab(tab);
    setCurrentPage(0);
  };

  return (
    <section className="py-12 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Títulos das Abas Centralizados */}
        <div className="flex justify-center items-center gap-8 md:gap-16 mb-10">
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

        {/* Carrossel de Produtos */}
        <div className="relative">
          <ProductCarousel 
            itemCount={products.length}
            activePage={currentPage}
            onPageChange={setCurrentPage}
          >
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
              />
            ))}
          </ProductCarousel>
        </div>

        {/* Bolinhas de Navegação */}
        <div className="flex justify-center items-center gap-3 mt-8">
          {[0, 1].map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                currentPage === page 
                  ? "bg-red-600 w-8" 
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Página ${page + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BestSellers;