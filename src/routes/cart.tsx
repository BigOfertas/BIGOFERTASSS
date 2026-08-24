import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCart } from '@/context/CartContext';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export const Route = createFileRoute('/cart')({
  component: CartPage,
});

function CartPage() {
  const { cart, removeFromCart, updateQuantity, totalPrice } = useCart();
  const navigate = useNavigate();

  const shipping = totalPrice > 150 ? 0 : 15.0;
  const discount = 0; // Mock discount
  const finalTotal = totalPrice + shipping - discount;

  if (cart.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 bg-white">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Seu carrinho está vazio</h1>
          <p className="text-gray-500">
            Você ainda não adicionou nenhum produto ao seu carrinho. Explore nossa loja para encontrar as melhores ofertas!
          </p>
          <Button 
            onClick={() => navigate({ to: '/products' })}
            className="bg-red-600 hover:bg-red-700 text-white w-full py-6 text-lg"
          >
            Voltar às Compras
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => window.history.back()}
            className="rounded-full hover:bg-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Meu Carrinho</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Mobile Summary (Alternative for sm/md per requirement 7) */}
          <div className="lg:hidden">
             {/* Order Summary will be here if needed, but per requirement 7, summary above list on mobile */}
          </div>

          {/* Left Column: Items List */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 space-y-6">
                {cart.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex flex-col sm:flex-row gap-6">
                      {/* Product Image */}
                      <div className="w-full sm:w-[100px] h-[100px] flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                        <img 
                          src={item.image_url || "/placeholder.svg"} 
                          alt={item.name}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      {/* Item Details */}
                      <div className="flex-grow flex flex-col justify-between">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <Link 
                              to="/product/$id" 
                              params={{ id: item.id }}
                              className="text-lg font-semibold text-gray-900 hover:text-red-600 transition-colors line-clamp-2"
                            >
                              {item.name}
                            </Link>
                            <p className="text-red-600 font-bold mt-1">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                            </p>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-2"
                            aria-label="Remover item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                          {/* Quantity Selector */}
                          <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-1">
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1 hover:text-red-600 transition-colors"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input 
                              type="number"
                              min="1"
                              max="99"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-12 text-center bg-transparent border-none focus:ring-0 font-medium text-gray-900"
                            />
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1 hover:text-red-600 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Subtotal */}
                          <div className="text-right">
                            <span className="text-sm text-gray-500 block">Subtotal</span>
                            <span className="text-lg font-bold text-gray-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < cart.length - 1 && <Separator className="mt-6" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary (Sticky) */}
          <div className="lg:col-span-4 lg:sticky lg:top-8 order-first lg:order-last mb-8 lg:mb-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Resumo do pedido</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice)}</span>
                </div>
                
                <div className="flex justify-between text-gray-600">
                  <span>Frete</span>
                  <span className={shipping === 0 ? "text-green-600 font-medium" : ""}>
                    {shipping === 0 ? 'Grátis' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(shipping)}
                  </span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto</span>
                    <span>-{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discount)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between items-end">
                  <span className="text-lg font-bold text-gray-900">TOTAL</span>
                  <span className="text-2xl font-black text-red-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotal)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Button 
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-bold transition-transform active:scale-95"
                  onClick={() => navigate({ to: '/checkout' })}
                >
                  Finalizar Compra
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full border-gray-200 hover:bg-gray-50 hover:text-red-600 transition-colors"
                  onClick={() => navigate({ to: '/products' })}
                >
                  Continuar Comprando
                </Button>
              </div>

              {shipping > 0 && (
                <p className="text-xs text-center text-gray-500">
                  Adicione mais {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(150 - totalPrice)} para ganhar <strong>frete grátis</strong>!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
