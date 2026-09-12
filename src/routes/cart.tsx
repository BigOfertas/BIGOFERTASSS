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

import { CheckoutPanel } from "@/components/cart/CheckoutPanel";
import { ShippingCalculator } from "@/components/cart/ShippingCalculator";
import { SizeGuideDialog } from "@/components/product/SizeGuideDialog";
import Header from "@/components/layout/Header";
import { ProductionNotice } from "@/components/orders/ProductionNotice";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { getCartQuantityLimit, type CartItem } from "@/lib/cart";
import { PROGRESSIVE_DISCOUNT_TIERS, getProgressiveDiscount } from "@/lib/progressive-discount";
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
    item.status === "needs_review" ? "Escolha novamente as opções deste item" : "Item indisponível";

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
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuote | null>(null);
  const [quotedPostalCode, setQuotedPostalCode] = useState<string | null>(null);

  useEffect(() => {
    void validateCart();
  }, [validateCart]);

  const discount = getProgressiveDiscount(totalItems, totalPrice);
  const shippingAmount = discount.freeShipping ? 0 : (selectedShipping?.totalPrice ?? 0);
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
            <p className="text-gray-500">Escolha seus produtos e volte aqui para finalizar.</p>
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
      <main className="px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-8 sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="h-10 w-10 shrink-0 rounded-full hover:bg-white"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Meu carrinho</h1>
                <p className="mt-0.5 text-xs text-gray-500 sm:mt-1">
                  Revise seus itens, descontos e entrega.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void validateCart()}
              disabled={isValidating}
              className="w-full gap-2 bg-white sm:w-auto"
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

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="space-y-4 lg:col-span-8">
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
                      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h2 className="text-sm font-black text-gray-950 sm:text-base">Seus produtos</h2>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    {cart.length} {cart.length === 1 ? "produto" : "produtos"}
                  </span>
                </div>

                <div className="space-y-4 p-3 sm:space-y-6 sm:p-6">
                  {cart.map((item, index) => {
                    const quantityLimit = getCartQuantityLimit(item.availableStock);
                    const editable = item.status === "available";
                    const hasSizeSelection = item.selectedOptions.some(
                      (option) =>
                        option.optionKind === "size" ||
                        option.optionName.toLocaleLowerCase("pt-BR").includes("tamanho"),
                    );

                    return (
                      <div key={item.lineId}>
                        <div className="flex items-start gap-3 sm:gap-6">
                          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 sm:h-[100px] sm:w-[100px]">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="px-2 text-center text-[10px] text-gray-400 sm:text-xs">
                                Imagem indisponível
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2 sm:gap-4">
                              <div className="min-w-0 flex-1">
                                <Link
                                  to="/product/$id"
                                  params={{ id: item.productSlug ?? item.productId }}
                                  className="line-clamp-2 text-sm font-bold leading-5 text-gray-900 transition-colors hover:text-red-600 motion-reduce:transition-none sm:text-lg sm:font-semibold sm:leading-normal"
                                >
                                  {item.name}
                                </Link>

                                <div className="mt-1">
                                  <CartStatus item={item} />
                                </div>

                                {item.selectedOptions.length > 0 ? (
                                  <dl className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-600 sm:mt-2 sm:gap-x-4 sm:gap-y-1 sm:text-xs">
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

                                <p className="mt-1.5 text-sm font-black text-red-600 sm:mt-2 sm:text-base">
                                  {currency.format(item.unitPrice)}
                                </p>

                                {hasSizeSelection ? (
                                  <div className="mt-1.5">
                                    <SizeGuideDialog
                                      productId={item.productId}
                                      triggerLabel="Conferir medidas"
                                      compact
                                    />
                                  </div>
                                ) : null}

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
                                className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 motion-reduce:transition-none"
                                aria-label={`Remover ${item.name}`}
                              >
                                <Trash2 className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                              </button>
                            </div>

                            <div className="mt-3 flex items-end justify-between gap-3 border-t border-gray-100 pt-3 sm:mt-4 sm:border-0 sm:pt-0">
                              <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                                  className="flex h-7 w-7 items-center justify-center transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300 motion-reduce:transition-none"
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
                                  className="w-9 border-none bg-transparent p-0 text-center text-sm font-bold text-gray-900 focus:ring-0 disabled:text-gray-400 sm:w-12 sm:font-medium"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                                  className="flex h-7 w-7 items-center justify-center transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:text-gray-300 motion-reduce:transition-none"
                                  disabled={!editable || item.quantity >= quantityLimit}
                                  aria-label="Aumentar quantidade"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="min-w-0 text-right">
                                <span className="block text-[10px] font-medium uppercase tracking-wide text-gray-400 sm:text-sm sm:font-normal sm:normal-case sm:tracking-normal sm:text-gray-500">
                                  Subtotal
                                </span>
                                <span className="block text-sm font-black text-gray-950 sm:text-lg sm:font-bold sm:text-gray-900">
                                  {currency.format(item.unitPrice * item.quantity)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {index < cart.length - 1 ? <Separator className="mt-4 sm:mt-6" /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:order-last lg:col-span-4 lg:sticky lg:top-32">
              <div className="space-y-5 rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:space-y-6 sm:p-6">
                <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Resumo do pedido</h2>

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
                              Você ganhou{" "}
                              <strong>{discount.percent}% de desconto e frete grátis</strong>.
                            </p>
                          </>
                        ) : discount.nextTier ? (
                          <>
                            <Sparkles className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                            <p>
                              Adicione mais <strong>{discount.nextTier.unitsRemaining}</strong>{" "}
                              {discount.nextTier.unitsRemaining === 1 ? "peça" : "peças"} para
                              ganhar <strong>{discount.nextTier.percent}% de desconto</strong>
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
                  onPostalCodeQuoted={setQuotedPostalCode}
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

                <div className="space-y-3 pt-2">
                  <CheckoutPanel
                    cart={cart}
                    selectedShipping={selectedShipping}
                    quotedPostalCode={quotedPostalCode}
                    hasBlockingIssues={hasBlockingIssues}
                  />

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
