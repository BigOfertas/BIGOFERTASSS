import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  CheckCircle2,
  Gift,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Trash2,
} from "lucide-react";

import { ShippingCalculator } from "@/components/cart/ShippingCalculator";
import Header from "@/components/layout/Header";
import { ProductionNotice } from "@/components/orders/ProductionNotice";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { getCartQuantityLimit, type CartItem } from "@/lib/cart";
import {
  PROGRESSIVE_DISCOUNT_TIERS,
  getProgressiveDiscount,
} from "@/lib/progressive-discount";
import type { ShippingQuote } from "@/lib/shipping";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function CartStatus({ item }: { item: CartItem }) {
  if (item.status === "available") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Disponível
      </span>
    );
  }

  const text =
    item.status === "needs_review"
      ? "Escolha novamente as opções deste item"
      : "Item indisponível";

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      {text}
    </span>
  );
}

function CartPage() {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    validateCart,
    isValidating,
    validationError,
    hasBlockingIssues,
    totalItems,
    totalPrice,
  } = useCart();
  const navigate = useNavigate();
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(
    null,
  );

  useEffect(() => {
    void validateCart();
  }, [validateCart]);

  const discount = getProgressiveDiscount(totalItems, totalPrice);
  const shippingAmount = discount.freeShipping
    ? 0
    : (selectedShipping?.totalPrice ?? 0);
  const total = discount.subtotalAfterDiscount + shippingAmount;
  const tiersAscending = [...PROGRESSIVE_DISCOUNT_TIERS].reverse();

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="flex min-h-[60vh] flex-col items-center justify-center p-4">
          <div className="max-w-md space-y-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <ShoppingBag className="h-10 w-10 text-gray-400" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Seu carrinho está vazio</h1>
            <p className="text-gray-500">
              Escolha seus produtos e volte aqui para finalizar.
            </p>
            <Button
              onClick={() => void navigate({ to: "/products" })}
              className="w-full bg-red-600 py-6 text-lg text-white hover:bg-red-700"
            >
              Ver produtos
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Header />
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="rounded-full hover:bg-white"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Meu carrinho</h1>
                <p className="mt-1 text-xs text-gray-500">
                  Revise seus itens, descontos e entrega.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void validateCart()}
              disabled={isValidating}
              className="gap-2 bg-white"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isValidating ? "animate-spin motion-reduce:animate-none" : ""
                }`}
              />
              {isValidating ? "Atualizando" : "Atualizar carrinho"}
            </Button>
          </div>

          {validationError ? (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
              <p>{validationError}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="space-y-6 p-6">
                  {cart.map((item, index) => {
                    const quantityLimit = getCartQuantityLimit(item.availableStock);
                    const editable = item.status === "available";

                    return (
                      <div key={item.lineId}>
                        <div className="flex flex-col gap-6 sm:flex-row">
                          <div className="flex h-[100px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 sm:w-[100px]">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="px-2 text-center text-xs text-gray-400">
                                Imagem indisponível
                              </span>
                            )}
                          </div>

                          <div className="flex flex-grow flex-col justify-between">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <Link
                                  to="/product/$id"
                                  params={{ id: item.productSlug ?? item.productId }}
                                  className="line-clamp-2 text-lg font-semibold text-gray-900 transition-colors hover:text-red-600 motion-reduce:transition-none"
                                >
                                  {item.name}
                                </Link>

                                <div className="mt-1">
                                  <CartStatus item={item} />
                                </div>

                                {item.selectedOptions.length > 0 ? (
                                  <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                                    {item.selectedOptions.map((option) => (
                                      <div
                                        key={`${item.lineId}-${option.optionId}`}
                                        className="flex gap-1"
                                      >
                                        <dt className="font-semibold">{option.optionName}:</dt>
                                        <dd>{option.valueLabel}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                ) : null}

                                <p className="mt-2 font-bold text-red-600">
                                  {currency.format(item.unitPrice)}
                                </p>

                                {item.status === "needs_review" ? (
                                  <Link
                                    to="/product/$id"
                                    params={{ id: item.productSlug ?? item.productId }}
                                    className="mt-2 inline-block text-xs font-bold text-red-600 underline underline-offset-2"
                                  >
                                    Revisar opções
                                  </Link>
                                ) : null}
                              </div>

                              <button
                                type="button"
                                onClick={() => removeFromCart(item.lineId)}
                                className="p-2 text-gray-400 transition-colors hover:text-red-600 motion-reduce:transition-none"
                                aria-label={`Remover ${item.name}`}
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(item.lineId, item.quantity - 1)
                                  }
                                  className="p-1 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300 motion-reduce:transition-none"
                                  disabled={!editable || item.quantity <= 1}
                                  aria-label="Diminuir quantidade"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={quantityLimit}
                                  value={item.quantity}
                                  disabled={!editable}
                                  aria-label={`Quantidade de ${item.name}`}
                                  onChange={(event) =>
                                    updateQuantity(
                                      item.lineId,
                                      Number.parseInt(event.target.value, 10) || 1,
                                    )
                                  }
                                  className="w-12 border-none bg-transparent text-center font-medium text-gray-900 focus:ring-0 disabled:text-gray-400"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(item.lineId, item.quantity + 1)
                                  }
                                  className="p-1 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300 motion-reduce:transition-none"
                                  disabled={!editable || item.quantity >= quantityLimit}
                                  aria-label="Aumentar quantidade"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="text-right">
                                <span className="block text-sm text-gray-500">Subtotal</span>
                                <span className="text-lg font-bold text-gray-900">
                                  {currency.format(item.unitPrice * item.quantity)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {index < cart.length - 1 ? <Separator className="mt-6" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="order-first mb-8 lg:order-last lg:col-span-4 lg:sticky lg:top-32 lg:mb-0">
              <div className="space-y-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900">Resumo do pedido</h2>

                <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-600 text-white">
                      <BadgePercent className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-emerald-950">
                            Desconto progressivo
                          </p>
                          <p className="mt-0.5 text-[11px] text-emerald-800/80">
                            {totalItems} {totalItems === 1 ? "peça" : "peças"} no carrinho
                          </p>
                        </div>
                        {discount.percent > 0 ? (
                          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-black text-white">
                            {discount.percent}% OFF
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tiersAscending.map((tier) => {
                          const unlocked = totalItems >= tier.minimumUnits;
                          return (
                            <span
                              key={tier.minimumUnits}
                              className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
                                unlocked
                                  ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                  : "border-gray-200 bg-white text-gray-500"
                              }`}
                            >
                              {tier.minimumUnits} peças · {tier.percent}%
                              {tier.freeShipping ? " + frete grátis" : ""}
                            </span>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-emerald-900">
                        {discount.freeShipping ? (
                          <>
                            <Gift className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                            <p>
                              Você ganhou <strong>{discount.percent}% de desconto e frete grátis</strong>.
                            </p>
                          </>
                        ) : discount.nextTier ? (
                          <>
                            <Sparkles className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                            <p>
                              Adicione mais <strong>{discount.nextTier.unitsRemaining}</strong>{" "}
                              {discount.nextTier.unitsRemaining === 1 ? "peça" : "peças"} para ganhar{" "}
                              <strong>{discount.nextTier.percent}% de desconto</strong>
                              {discount.nextTier.freeShipping ? " e frete grátis" : ""}.
                            </p>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>

                <ShippingCalculator
                  cart={cart}
                  selectedQuote={selectedShipping}
                  onSelectionChange={setSelectedShipping}
                  freeShipping={discount.freeShipping}
                />

                <Separator />

                <div className="space-y-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{currency.format(totalPrice)}</span>
                  </div>

                  {discount.discountAmount > 0 ? (
                    <div className="flex justify-between gap-4 font-semibold text-emerald-700">
                      <span>Desconto ({discount.percent}%)</span>
                      <span>-{currency.format(discount.discountAmount)}</span>
                    </div>
                  ) : null}

                  <div className="flex justify-between text-gray-600">
                    <span>Frete</span>
                    <span
                      className={`font-medium ${
                        discount.freeShipping ? "text-emerald-700" : "text-gray-900"
                      }`}
                    >
                      {discount.freeShipping
                        ? "GRÁTIS"
                        : selectedShipping
                          ? currency.format(selectedShipping.totalPrice)
                          : "A calcular"}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex items-end justify-between gap-4">
                    <span className="text-lg font-bold text-gray-900">TOTAL</span>
                    <span className="text-2xl font-black text-red-600">
                      {currency.format(total)}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-gray-500">
                    {discount.freeShipping
                      ? "A partir de 8 peças, o frete é grátis."
                      : selectedShipping
                        ? `Entrega selecionada: ${selectedShipping.service}.`
                        : "Informe o CEP para ver as opções de entrega."}
                  </p>

                  {hasBlockingIssues ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                      Alguns itens precisam ser revisados antes de continuar.
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 pt-2">
                  <Button type="button" disabled className="w-full py-6 text-lg font-bold">
                    Finalizar compra
                  </Button>
                  <p className="text-center text-[11px] text-gray-400">
                    A finalização estará disponível em breve.
                  </p>

                  <Button
                    variant="outline"
                    className="w-full border-gray-200 transition-colors hover:bg-gray-50 hover:text-red-600 motion-reduce:transition-none"
                    onClick={() => void navigate({ to: "/products" })}
                  >
                    Continuar comprando
                  </Button>
                </div>
              </div>

              <div className="mt-5">
                <ProductionNotice compact />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
