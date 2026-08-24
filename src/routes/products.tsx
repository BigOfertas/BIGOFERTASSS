import React from "react";
import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/product/ProductCard";
import Header from "@/components/layout/Header";
import { z } from "zod";

// Validação dos query params
const productSearchSchema = z.object({
  campeonato: z.string().optional(),
  liga: z.string().optional(),
  time: z.string().optional(),
  category: z.string().optional(),
});

type ProductSearch = z.infer<typeof productSearchSchema>;

export const Route = createFileRoute("/products")({
  validateSearch: (search) => productSearchSchema.parse(search),
  component: ProductsPage,
});

function ProductsPage() {
  const search = useSearch({ from: "/products" }) as ProductSearch;

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*");
      
      if (error) throw error;
      return data;
    },
  });

  // Filtro local em JavaScript conforme requisito 3
  const filteredProducts = products?.filter((product) => {
    let matches = true;
    
    if (search.campeonato && product.campeonato !== search.campeonato) {
      matches = false;
    }
    
    if (search.liga && product.liga !== search.liga) {
      matches = false;
    }
    
    if (search.time && product.time !== search.time) {
      matches = false;
    }
    
    if (search.category && product.category !== search.category) {
      matches = false;
    }
    
    return matches;
  });

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Header />
        <main className="flex-grow flex items-center justify-center p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Erro ao carregar produtos</h2>
            <p className="text-gray-600">Por favor, tente novamente mais tarde.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 lg:px-8 py-8 md:py-12">
        {/* Layout em 2 colunas: Sidebar (vazia por enquanto) + Grid */}
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Coluna Esquerda: Sidebar (Placeholder para filtros da Parte 2) */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h2 className="text-lg font-black uppercase tracking-tight mb-4 text-gray-900 border-b pb-2">
                Filtros
              </h2>
              <div className="space-y-4">
                <p className="text-sm text-gray-500 italic">
                  Filtros detalhados serão implementados na próxima etapa.
                </p>
                {/* Link para limpar filtros se houver algum ativo */}
                {(search.campeonato || search.liga || search.time) && (
                  <Link 
                    to="/products" 
                    className="text-xs font-bold text-red-600 uppercase hover:underline"
                  >
                    Limpar Filtros
                  </Link>
                )}
              </div>
            </div>
          </aside>

          {/* Coluna Direita: Grid de Produtos */}
          <div className="flex-1">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] bg-gray-100 animate-pulse rounded-md" />
                ))}
              </div>
            ) : filteredProducts && filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price}
                    imageUrl={product.image_url}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <h3 className="text-xl font-bold text-gray-400 uppercase italic">
                  Nenhum produto encontrado
                </h3>
                <p className="text-gray-500 mt-2">
                  Tente ajustar seus filtros para encontrar o que procura.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
