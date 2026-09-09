import { Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { getProgressiveDiscount } from "@/lib/progressive-discount";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function MiniCartDrawer() {
  const {
    cart,
    cartDrawerOpen,
    setCartDrawerOpen,
    removeFromCart,
    totalItems,
    totalPrice,
  } = useCart();
  const discount = getProgressiveDiscount(totalItems, totalPrice);

  useEffect(() => {
    if (!cartDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartDrawerOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cartDrawerOpen, setCartDrawerOpen]);

  if (!cartDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Carrinho rápido">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="Fechar carrinho rápido"
        onClick={() => setCartDrawerOpen(false)}
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-600">Seu pedido</p>
            <h2 className="text-xl font-black tracking-tight text-gray-950">
              Carrinho · {totalItems} {totalItems === 1 ? "peça" : "peças"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-950"
            aria-label="Fechar carrinho rápido"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <ShoppingBag className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-black text-gray-950">Seu carrinho está vazio</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Explore o catálogo para escolher sua próxima camisa.
            </p>
            <Button asChild className="mt-6 bg-red-600 text-white hover:bg-red-700">
              <Link to="/products" search={{}} onClick={() => setCartDrawerOpen(false)}>
                Ver produtos
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
              {cart.slice().reverse().map((item) => (
                <div key={item.lineId} className="flex gap-4 border-b border-gray-100 py-4">
                  <Link
                    to="/product/$id"
                    params={{ id: item.productSlug ?? item.productId }}
                    onClick={() => setCartDrawerOpen(false)}
                    className="flex h-24 w-20 flex-none items-center justify-center overflow-hidden rounded-lg bg-gray-50"
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <ShoppingBag className="h-5 w-5 text-gray-300" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <Link
                        to="/product/$id"
                        params={{ id: item.productSlug ?? item.productId }}
                        onClick={() => setCartDrawerOpen(false)}
                        className="line-clamp-2 flex-1 text-sm font-bold leading-5 text-gray-950 hover:text-red-600"
                      >
                        {item.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.lineId)}
                        className="flex h-8 w-8 flex-none items-center justify-center text-gray-400 hover:text-red-600"
                        aria-label={`Remover ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {item.selectedOptions.length > 0 ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-500">
                        {item.selectedOptions.map((option) => `${option.optionName}: ${option.valueLabel}`).join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <span className="text-xs font-semibold text-gray-500">Qtd. {item.quantity}</span>
                      <strong className="text-sm text-gray-950">
                        {currency.format(item.unitPrice * item.quantity)}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 bg-white p-5">
              {discount.nextTier ? (
                <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-900">
                  Adicione mais <strong>{discount.nextTier.unitsRemaining}</strong>{" "}
                  {discount.nextTier.unitsRemaining === 1 ? "peça" : "peças"} para chegar a{" "}
                  <strong>{discount.nextTier.percent}% de desconto</strong>
                  {discount.nextTier.freeShipping ? " + frete grátis" : ""}.
                </div>
              ) : discount.percent > 0 ? (
                <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-900">
                  Você já desbloqueou {discount.percent}% de desconto
                  {discount.freeShipping ? " e frete grátis" : ""}.
                </div>
              ) : null}

              <div className="mb-4 flex items-end justify-between gap-4">
                <span className="text-sm font-semibold text-gray-600">Subtotal</span>
                <strong className="text-xl font-black text-gray-950">
                  {currency.format(totalPrice)}
                </strong>
              </div>
              <Button asChild className="h-12 w-full bg-red-600 font-black text-white hover:bg-black">
                <Link to="/cart" onClick={() => setCartDrawerOpen(false)}>
                  Ir para o carrinho
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <button
                type="button"
                onClick={() => setCartDrawerOpen(false)}
                className="mt-3 w-full py-2 text-xs font-bold text-gray-500 hover:text-red-600"
              >
                Continuar comprando
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
