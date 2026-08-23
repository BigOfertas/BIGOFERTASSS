import React from "react";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";

// Mock data conforme solicitado (sem mexer no banco nesta etapa)
const MOCK_PRODUCTS = [
  { id: "1", name: "Camisa Brasil I 2024 - Torcedor Nike Masculina", price: 349.99 },
  { id: "2", name: "Camisa Real Madrid Home 24/25 - Adidas Masculina", price: 399.99 },
  { id: "3", name: "Camisa Argentina I 2024 - Campeão do Mundo Masculina", price: 349.99 },
  { id: "4", name: "Camisa Portugal Home 24/25 Nike Masculina", price: 349.99 },
  { id: "5", name: "Camisa Manchester City Home 24/25 Puma Masculina", price: 399.99 },
  { id: "6", name: "Camisa Flamengo Home 2024 Adidas Masculina", price: 349.99 },
  { id: "7", name: "Camisa Palmeiras Home 2024 Puma Masculina", price: 349.99 },
  { id: "8", name: "Camisa São Paulo Home 2024 New Balance Masculina", price: 349.99 },
];

const BestSellers: React.FC = () => {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Título da Seção */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase text-gray-900 leading-none">
            Mais <span className="text-red-600">vendidos</span>
          </h2>
          <div className="h-[2px] flex-1 bg-gray-100 ml-8 hidden md:block"></div>
        </div>

        {/* Carrossel de Produtos */}
        <ProductCarousel itemCount={MOCK_PRODUCTS.length}>
          {MOCK_PRODUCTS.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              price={product.price}
            />
          ))}
        </ProductCarousel>
      </div>
    </section>
  );
};

export default BestSellers;