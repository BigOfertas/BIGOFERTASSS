import { Check, Loader2, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCart } from "@/context/CartContext";
import type { CartOptionSnapshot } from "@/lib/cart";
import {
  fetchProductDetail,
  getVariantEffectivePrice,
  type ProductDetailData,
  type ProductVariantWithValues,
} from "@/lib/product-detail";
import {
  EMPTY_PURCHASE_CUSTOMIZATION,
  customizationToCartOptions,
  fetchProductPurchaseConfig,
  validatePurchaseCustomization,
  type ProductPurchaseConfig,
} from "@/lib/product-purchase";

interface ProductQuickAddProps {
  productId: string;
  productSlug?: string | null;
  productName: string;
  imageUrl: string | null;
}

const QUICK_ADD_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs = QUICK_ADD_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Tempo limite ao carregar o produto.")),
      timeoutMs,
    );

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function resolveQuickAddVariant(detail: ProductDetailData): ProductVariantWithValues | null {
  return detail.variants.find((variant) => variant.is_default) ?? detail.variants[0] ?? null;
}

function variantOptions(
  detail: ProductDetailData,
  variant: ProductVariantWithValues,
): CartOptionSnapshot[] {
  return detail.options.flatMap((option) => {
    const valueId = variant.optionValueIds[option.id];
    const value = option.values.find((candidate) => candidate.id === valueId);
    if (!value) return [];

    return [
      {
        optionId: option.id,
        optionName: option.name,
        optionKind: option.kind,
        valueId: value.id,
        valueLabel: value.value,
      },
    ];
  });
}

export function ProductQuickAdd({
  productId,
  productSlug,
  productName,
  imageUrl,
}: ProductQuickAddProps) {
  const { addToCart } = useCart();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ProductPurchaseConfig | null>(null);
  const [detail, setDetail] = useState<ProductDetailData | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [lastAddedSize, setLastAddedSize] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let active = true;

    if (!config && !configLoading) {
      setConfigLoading(true);
      setConfigError("");

      void withTimeout(fetchProductPurchaseConfig(productId))
        .then((value) => {
          if (active) setConfig(value);
        })
        .catch(() => {
          if (active) setConfigError("Não foi possível carregar os tamanhos agora.");
        })
        .finally(() => {
          if (active) setConfigLoading(false);
        });
    }

    if (!detail && !detailLoading) {
      setDetailLoading(true);
      setDetailError("");

      void withTimeout(fetchProductDetail(productSlug || productId))
        .then((value) => {
          if (active) setDetail(value);
        })
        .catch(() => {
          if (active) {
            setDetailError("Abra o produto para concluir a escolha deste item.");
          }
        })
        .finally(() => {
          if (active) setDetailLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [config, configLoading, detail, detailLoading, open, productId, productSlug]);

  const variant = useMemo(() => (detail ? resolveQuickAddVariant(detail) : null), [detail]);

  const addWithSize = (size: string | null) => {
    if (!config) {
      setConfigError("Não foi possível carregar os tamanhos agora.");
      return;
    }

    if (!detail || !variant) {
      setDetailError("Abra o produto para concluir a escolha deste item.");
      return;
    }

    const customization = {
      ...EMPTY_PURCHASE_CUSTOMIZATION,
      size,
    };
    const validationError = validatePurchaseCustomization(config, customization);
    if (validationError) {
      setConfigError(validationError);
      return;
    }

    const selectedOptions = [
      ...variantOptions(detail, variant),
      ...customizationToCartOptions(config, customization),
    ];

    addToCart({
      productId: detail.product.id,
      productSlug: detail.product.slug,
      variantId: variant.id,
      sku: variant.sku,
      name: detail.product.name,
      variantName: variant.name,
      unitPrice: getVariantEffectivePrice(detail.product, variant),
      imageUrl: imageUrl ?? detail.product.displayImageUrl,
      availableStock: variant.stock_quantity,
      selectedOptions,
      customization,
    });

    setLastAddedSize(size);
    window.setTimeout(() => {
      setOpen(false);
      setLastAddedSize(null);
    }, 220);
  };

  const sizes = config?.sizeEnabled ? config.sizes : [];
  const productParams = { id: productSlug || productId };
  const productReady = Boolean(detail && variant);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-600 hover:text-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:translate-y-0"
          aria-label={`Adicionar ${productName} ao carrinho`}
          title="Adicionar ao carrinho"
          data-product-quick-add-trigger
        >
          <ShoppingCart className="h-4.5 w-4.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="top"
        sideOffset={10}
        className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl"
        data-product-quick-add-panel
      >
        <div className="mb-3">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-600">
            Adicionar ao carrinho
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-gray-950">
            {productName}
          </p>
        </div>

        {configLoading && !config ? (
          <div className="flex min-h-20 items-center justify-center gap-2 text-sm font-semibold text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            Carregando tamanhos...
          </div>
        ) : configError && !config ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              {configError}
            </div>
            <Link
              to="/product/$id"
              params={productParams}
              className="flex h-10 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-xs font-black text-white hover:bg-black"
            >
              Abrir produto
            </Link>
          </div>
        ) : config ? (
          config.sizeEnabled ? (
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-gray-700">Escolha o tamanho</legend>
              <div className="grid grid-cols-4 gap-2" data-product-quick-add-sizes>
                {sizes.map((size) => {
                  const added = lastAddedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => addWithSize(size)}
                      disabled={!productReady}
                      className={`flex min-h-10 items-center justify-center rounded-lg border px-2 text-xs font-black transition-all duration-150 disabled:cursor-wait disabled:opacity-55 ${
                        added
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-200 bg-white text-gray-800 hover:border-red-500 hover:bg-red-50 hover:text-red-700 active:scale-95"
                      }`}
                      aria-label={`Adicionar tamanho ${size}`}
                    >
                      {added ? <Check className="h-4 w-4" aria-hidden="true" /> : size}
                    </button>
                  );
                })}
              </div>

              {detailLoading && !detail ? (
                <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                  Preparando produto...
                </div>
              ) : detailError && !detail ? (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold leading-4 text-amber-700">{detailError}</p>
                  <Link
                    to="/product/$id"
                    params={productParams}
                    className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-[11px] font-black text-red-700 hover:bg-red-600 hover:text-white"
                  >
                    Abrir produto
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-[11px] leading-4 text-gray-500">
                  Toque no tamanho para adicionar imediatamente.
                </p>
              )}
            </fieldset>
          ) : productReady ? (
            <button
              type="button"
              onClick={() => addWithSize(null)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white transition hover:bg-black"
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              Adicionar
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex min-h-16 items-center justify-center gap-2 text-sm font-semibold text-gray-500">
                {detailLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                    Preparando produto...
                  </>
                ) : (
                  <span>{detailError || "Não foi possível preparar este produto."}</span>
                )}
              </div>
              {!detailLoading ? (
                <Link
                  to="/product/$id"
                  params={productParams}
                  className="flex h-10 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-xs font-black text-white hover:bg-black"
                >
                  Abrir produto
                </Link>
              ) : null}
            </div>
          )
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
