import React from "react";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";

const MOCK_BRASILEIRAO = Array.from({ length: 15 }, (_, i) => ({
  id: `br-${i + 1}`,
  name: `Camisa Oficial Brasileirão ${i + 1}`,
  price: 299.99,
}));

const BrazilianProducts: React.FC = () => {
  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-12 text-center text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none text-gray-900">
          PRODUTOS DO <span className="text-green-600">BRASILEIRÃO</span>
        </h2>

        <div className="relative">
          <ProductCarousel itemCount={MOCK_BRASILEIRAO.length}>
            {MOCK_BRASILEIRAO.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                price={product.price}
              />
            ))}
          </ProductCarousel>
        </div>
      </div>
    </section>
  );
};

export default BrazilianProducts;