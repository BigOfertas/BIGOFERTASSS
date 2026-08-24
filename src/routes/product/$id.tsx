import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ShoppingCart, Check, AlertTriangle, Package, Tag, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute('/product/$id')({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 font-medium">Carregando produto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <AlertTriangle className="w-16 h-16 text-red-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Produto não encontrado</h1>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          Não conseguimos encontrar o produto que você está procurando. Ele pode ter sido removido ou o link está incorreto.
        </p>
        <Button 
          asChild
          className="bg-red-600 hover:bg-black text-white font-bold"
        >
          <Link to="/">Voltar para a Home</Link>
        </Button>
      </div>
    );
  }

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price);

  const stock = product.stock ?? 0;
  const inStock = stock > 0;

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  const specs = product.specifications?.split('|').map(s => s.trim()) || [];

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Navigation Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 sm:py-6">
        <Link 
          to="/products"
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors group w-fit"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar para Produtos
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Product Image Section */}
          <div className="relative aspect-square sm:aspect-[4/5] bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border border-gray-100 shadow-sm">
            <img 
              src={product.image_url} 
              alt={product.name}
              className="w-full h-full object-contain p-6 sm:p-12 hover:scale-105 transition-transform duration-700"
            />
            {!inStock && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[2px]">
                <span className="bg-black text-white px-6 py-2 rounded-full font-black italic uppercase tracking-tighter">
                  Fora de Estoque
                </span>
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-gray-100 text-gray-600 text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded">
                  {product.category || 'Geral'}
                </span>
                {inStock ? (
                  <span className="flex items-center gap-1 text-green-600 text-[10px] uppercase font-bold tracking-widest">
                    <Check className="w-3 h-3" /> Em Estoque
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600 text-[10px] uppercase font-bold tracking-widest">
                    <AlertTriangle className="w-3 h-3" /> Esgotado
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl font-black italic text-gray-900 tracking-tighter leading-tight mb-4 uppercase">
                {product.name}
              </h1>
              <div className="text-3xl sm:text-4xl font-black text-red-600 tracking-tighter mb-6">
                {formattedPrice}
              </div>
              <div className="prose prose-sm text-gray-600 leading-relaxed max-w-none">
                {product.description || 'Nenhuma descrição disponível para este produto.'}
              </div>
            </div>

            {/* Action Section */}
            <div className="mt-auto space-y-6 pt-6 border-t border-gray-100">
              {inStock && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                    <button 
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="px-4 py-2 hover:bg-gray-50 text-gray-600 transition-colors font-bold"
                    >
                      -
                    </button>
                    <span className="px-4 py-2 text-gray-900 font-bold w-12 text-center border-x border-gray-300">
                      {quantity}
                    </span>
                    <button 
                      onClick={() => setQuantity(q => Math.min(stock, q + 1))}
                      className="px-4 py-2 hover:bg-gray-50 text-gray-600 transition-colors font-bold"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {stock} unidades disponíveis
                  </span>
                </div>
              )}

              <Button 
                onClick={handleAddToCart}
                disabled={!inStock}
                className={`w-full h-14 sm:h-16 text-lg font-black italic uppercase tracking-tighter rounded-sm transition-all duration-300 flex items-center justify-center gap-3 ${
                  inStock 
                  ? 'bg-red-600 hover:bg-black text-white shadow-lg shadow-red-600/20 hover:shadow-black/20' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="w-6 h-6" />
                {inStock ? 'Adicionar ao Carrinho' : 'Indisponível'}
              </Button>
              
              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 py-6 border-y border-gray-100">
                <div className="flex flex-col items-center text-center gap-2">
                  <Package className="w-5 h-5 text-red-600" />
                  <span className="text-[10px] font-bold uppercase text-gray-500 leading-tight">Envio Imediato</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2 border-x border-gray-100">
                  <Tag className="w-5 h-5 text-red-600" />
                  <span className="text-[10px] font-bold uppercase text-gray-500 leading-tight">Preço Imbatível</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2">
                  <Info className="w-5 h-5 text-red-600" />
                  <span className="text-[10px] font-bold uppercase text-gray-500 leading-tight">Compra Segura</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Specifications Section */}
        {specs.length > 0 && (
          <div className="mt-16 sm:mt-24 max-w-3xl">
            <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter text-gray-900 mb-8 flex items-center gap-3">
              <span className="w-1.5 h-8 bg-red-600"></span>
              Especificações Técnicas
            </h2>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="specs" className="border-gray-200">
                <AccordionTrigger className="text-gray-900 font-bold hover:text-red-600 transition-colors uppercase text-sm italic tracking-tight">
                  Ver detalhes técnicos
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-4 pt-4">
                    {specs.map((spec, index) => {
                      const [label, value] = spec.split(':').map(s => s.trim());
                      return (
                        <li key={index} className="flex justify-between items-center text-sm py-2 border-b border-gray-50 last:border-0">
                          <span className="text-gray-500 font-medium uppercase tracking-wider text-[11px]">{label}</span>
                          <span className="text-gray-900 font-bold">{value}</span>
                        </li>
                      );
                    })}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
}
