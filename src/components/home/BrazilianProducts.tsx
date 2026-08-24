import React from "react";
import ProductCard from "@/components/product/ProductCard";
import ProductCarousel from "@/components/product/ProductCarousel";

const REAL_PRODUCT_ID = "42981de6-11e1-4951-98f9-4914a35c20a4";

const MOCK_BRASILEIRAO = Array.from({ length: 15 }, (_, i) => ({
  id: i === 0 ? REAL_PRODUCT_ID : `br-${i + 1}`,
  name: i === 0 ? "Camisa Profissional BIGofertas 2024" : `Camisa Oficial Brasileirão ${i + 1}`,
  price: i === 0 ? 199.90 : 299.99,
}));

const BrazilianProducts: React.FC = () => {
  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-12 text-center text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none text-gray-900">
          PRODUTOS DO <span className="text-red-600">BRASILEIRÃO</span>
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
