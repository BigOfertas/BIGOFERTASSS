import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Factory,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

import Header from "@/components/layout/Header";
import ProductCard from "@/components/product/ProductCard";
import ProductGallery from "@/components/product/ProductGallery";
import { ProductShippingCalculator } from "@/components/product/ProductShippingCalculator";
import { ProductPurchaseOptions } from "@/components/product/ProductPurchaseOptions";
import ProductSeo from "@/components/product/ProductSeo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { useCart } from "@/context/CartContext";
import {
  fetchProductDetail,
  fetchRelatedProducts,
  findVariantForSelection,
  getDefaultProductVariant,
  getVariantBasePrice,
  getVariantEffectivePrice,
  getVariantPromotionalPrice,
  isValueCompatibleWithSelection,
} from "@/lib/product-detail";
import { getProductGalleryItems } from "@/lib/product-images";
import {
  EMPTY_PURCHASE_CUSTOMIZATION,
  calculatePurchaseSurcharge,
  customizationToCartOptions,
  fetchProductPurchaseConfig,
  validatePurchaseCustomization,
} from "@/lib/product-purchase";

export const Route = createFileRoute("/product/$id")({
  head: () => ({
    meta: [
      { title: `Produto | ${BRAND.officialName}` },
      {
        name: "description",
        content: `Confira os detalhes do produto no catálogo ${BRAND.officialName}.`,
      },
    ],
  }),
  component: ProductDetail,
});

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parseLegacySpecifications(value: string | null) {
  return (
    value
      ?.split("|")
      .map((spec) => spec.trim())
      .filter(Boolean)
      .map((spec) => {
        const separatorIndex = spec.indexOf(":");
        return {
          label: separatorIndex >= 0 ? spec.slice(0, separatorIndex).trim() : "Detalhe",
          value: separatorIndex >= 0 ? spec.slice(separatorIndex + 1).trim() : spec,
        };
      }) ?? []
  );
}

function ProductDetail() {
  const { id } = Route.useParams();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [purchaseCustomization, setPurchaseCustomization] = useState(EMPTY_PURCHASE_CUSTOMIZATION);

  const {
    data: detail,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product-detail", id],
    queryFn: () => fetchProductDetail(id),
    staleTime: 60_000,
  });

  const product = detail?.product ?? null;
  const defaultVariant = useMemo(
    () => getDefaultProductVariant(detail?.variants ?? []),
    [detail?.variants],
  );

  useEffect(() => {
    if (!detail) return;

    const initialVariant = getDefaultProductVariant(detail.variants);
    setSelection(initialVariant?.optionValueIds ?? {});
    setQuantity(1);
    setPurchaseCustomization(EMPTY_PURCHASE_CUSTOMIZATION);
  }, [detail]);

  const requiredOptionIds = useMemo(
    () => detail?.options.filter((option) => option.is_required).map((option) => option.id) ?? [],
    [detail?.options],
  );

  const selectedVariant = useMemo(() => {
    if (!detail) return null;
    if (detail.options.length === 0) return defaultVariant;

    return findVariantForSelection(detail.variants, selection, requiredOptionIds);
  }, [defaultVariant, detail, requiredOptionIds, selection]);

  const selectionComplete = requiredOptionIds.every((optionId) => selection[optionId]);
  const availableToOrder = Boolean(selectedVariant);

  const gallery = useMemo(
    () =>
      product
        ? getProductGalleryItems(
            product,
            product.images,
            selectedVariant?.id ?? defaultVariant?.id ?? null,
          )
        : [],
    [defaultVariant?.id, product, selectedVariant?.id],
  );

  const purchaseConfigQuery = useQuery({
    queryKey: ["product-purchase-config", product?.id],
    queryFn: () => fetchProductPurchaseConfig(product!.id),
    enabled: Boolean(product),
    staleTime: 60_000,
  });
  const purchaseConfig = purchaseConfigQuery.data ?? null;

  const relatedQuery = useQuery({
    queryKey: [
      "product-related",
      product?.id,
      product?.time_key,
      product?.liga_key,
      product?.campeonato_key,
      detail?.category?.slug,
    ],
    queryFn: () => fetchRelatedProducts(product!, detail?.category?.slug ?? null),
    enabled: Boolean(product),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <div className="mb-6 h-5 w-72 animate-pulse rounded bg-gray-100" />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
            <div className="aspect-square animate-pulse rounded-xl bg-gray-100 sm:aspect-[4/5]" />
            <div className="space-y-5 py-4">
              <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
              <div className="h-12 w-4/5 animate-pulse rounded bg-gray-100" />
              <div className="h-10 w-40 animate-pulse rounded bg-gray-100" />
              <div className="h-24 w-full animate-pulse rounded bg-gray-50" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !detail || !product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="flex min-h-[60vh] flex-col items-center justify-center px-4">
          <AlertTriangle className="mb-4 h-16 w-16 text-red-600" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Produto não encontrado</h1>
          <p className="mb-6 max-w-md text-center text-gray-500">
            O produto pode ter sido removido, estar indisponível ou o link pode estar incorreto.
          </p>
          <Button asChild className="bg-red-600 font-bold text-white hover:bg-black">
            <Link to="/products" search={{}}>
              Voltar para Produtos
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const basePrice = selectedVariant ? getVariantBasePrice(product, selectedVariant) : product.price;
  const promotionalPrice = selectedVariant
    ? getVariantPromotionalPrice(product, selectedVariant)
    : product.promotional_price;
  const effectivePrice = selectedVariant
    ? getVariantEffectivePrice(product, selectedVariant)
    : (promotionalPrice ?? basePrice);
  const hasPromotion = promotionalPrice !== null && promotionalPrice < basePrice;
  const formattedPrice = currency.format(effectivePrice);
  const formattedOriginalPrice = hasPromotion ? currency.format(basePrice) : null;

  const variantSelectedOptions = detail.options.flatMap((option) => {
    const valueId = selection[option.id];
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

  const purchaseSurcharge = purchaseConfig
    ? calculatePurchaseSurcharge(purchaseConfig, purchaseCustomization)
    : 0;
  const finalUnitPrice = effectivePrice + purchaseSurcharge;
  const selectedOptions = purchaseConfig
    ? [
        ...variantSelectedOptions,
        ...customizationToCartOptions(purchaseConfig, purchaseCustomization),
      ]
    : variantSelectedOptions;

  const builtInSpecs = [
    detail.category?.name || product.category
      ? { label: "Categoria", value: detail.category?.name ?? product.category ?? "" }
      : null,
    product.time ? { label: "Time", value: product.time } : null,
    product.liga ? { label: "Liga", value: product.liga } : null,
    product.campeonato ? { label: "Campeonato", value: product.campeonato } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item?.value));

  const specifications = [...builtInSpecs, ...parseLegacySpecifications(product.specifications)];

  const handleAddToCart = () => {
    if (!selectedVariant || !selectionComplete) {
      toast.error("Selecione as opções do produto antes de continuar.");
      return;
    }
    if (!purchaseConfig) {
      toast.error("As opções de compra ainda estão carregando.");
      return;
    }
    const purchaseError = validatePurchaseCustomization(purchaseConfig, purchaseCustomization);
    if (purchaseError) {
      toast.error(purchaseError);
      return;
    }

    addToCart(
      {
        productId: product.id,
        productSlug: product.slug,
        variantId: selectedVariant.id,
        sku: selectedVariant.sku,
        name: product.name,
        variantName: selectedVariant.name,
        unitPrice: finalUnitPrice,
        imageUrl: gallery[0]?.url ?? product.displayImageUrl,
        availableStock: null,
        selectedOptions,
        customization: purchaseCustomization,
      },
      quantity,
    );
  };

  return (
    <div className="min-h-screen bg-white pb-32 md:pb-20">
      <ProductSeo
        product={product}
        selectedVariant={selectedVariant}
        price={effectivePrice}
        inStock={availableToOrder}
        images={gallery}
      />
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-5 lg:px-8">
        <nav
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-medium text-gray-500"
          aria-label="Breadcrumb"
        >
          <Link to="/" className="hover:text-red-600">
            Início
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link to="/products" search={{}} className="hover:text-red-600">
            Produtos
          </Link>
          {detail.category ? (
            <>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <Link
                to="/products"
                search={{ category: detail.category.slug }}
                className="hover:text-red-600"
              >
                {detail.category.name}
              </Link>
            </>
          ) : null}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="max-w-[280px] truncate text-gray-800" aria-current="page">
            {product.name}
          </span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
          <ProductGallery
            images={gallery}
            productName={product.name}
            unavailable={selectionComplete && !availableToOrder}
          />

          <section className="flex flex-col" aria-labelledby="product-title">
            <div className="mb-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(detail.category?.name ?? product.category) ? (
                  <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    {detail.category?.name ?? product.category}
                  </span>
                ) : null}
                {selectedVariant && selectionComplete ? (
                  availableToOrder ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                      <Check className="h-3 w-3" /> Sob encomenda
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-red-600">
                      <AlertTriangle className="h-3 w-3" /> Combinação indisponível
                    </span>
                  )
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Selecione uma opção
                  </span>
                )}
              </div>

              <h1
                id="product-title"
                className="mb-3 text-2xl font-black uppercase leading-tight tracking-tighter text-gray-900 sm:text-4xl"
              >
                {product.name}
              </h1>
              <div className="mb-6" aria-live="polite">
                {formattedOriginalPrice ? (
                  <div className="mb-1 text-sm font-medium text-gray-400 line-through sm:text-base">
                    {formattedOriginalPrice}
                  </div>
                ) : null}
                <div className="text-3xl font-black tracking-tighter text-red-600 sm:text-4xl">
                  {formattedPrice}
                </div>
              </div>

              {product.description ? (
                <p className="max-w-2xl leading-relaxed text-gray-600">{product.description}</p>
              ) : null}
            </div>

            {detail.options.length > 0 ? (
              <div className="space-y-6 border-t border-gray-100 py-6">
                {detail.options.map((option) => (
                  <fieldset key={option.id}>
                    <legend className="mb-3 text-xs font-black uppercase tracking-widest text-gray-800">
                      {option.name}
                      {option.is_required ? (
                        <span className="ml-1 text-red-600" aria-hidden="true">
                          *
                        </span>
                      ) : null}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const compatible = isValueCompatibleWithSelection(
                          detail.variants,
                          option.id,
                          value.id,
                          {},
                        );
                        const selected = selection[option.id] === value.id;

                        return (
                          <button
                            key={value.id}
                            type="button"
                            disabled={!compatible}
                            onClick={() =>
                              setSelection((current) => {
                                const next = { ...current, [option.id]: value.id };
                                const exactMatch = findVariantForSelection(
                                  detail.variants,
                                  next,
                                  requiredOptionIds,
                                );

                                if (exactMatch) {
                                  return next;
                                }

                                const fallbackVariant = detail.variants.find(
                                  (variant) => variant.optionValueIds[option.id] === value.id,
                                );

                                return fallbackVariant
                                  ? { ...fallbackVariant.optionValueIds }
                                  : next;
                              })
                            }
                            className={`min-h-11 min-w-12 rounded-md border px-4 py-2 text-sm font-bold transition-colors ${
                              selected
                                ? "border-red-600 bg-red-600 text-white"
                                : compatible
                                  ? "border-gray-300 bg-white text-gray-800 hover:border-red-600"
                                  : "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300 line-through"
                            }`}
                            aria-pressed={selected}
                          >
                            {value.value}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : null}

            {purchaseConfig ? (
              <ProductPurchaseOptions
                config={purchaseConfig}
                value={purchaseCustomization}
                onChange={setPurchaseCustomization}
              />
            ) : null}

            <div className="my-5">
              <ProductShippingCalculator productId={product.id} quantity={quantity} />
            </div>

            <div className="mt-auto space-y-5 border-t border-gray-100 pt-6">
              {selectedVariant && selectionComplete ? (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center overflow-hidden rounded-md border border-gray-300">
                    <button
                      type="button"
                      aria-label="Diminuir quantidade"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      className="flex h-11 w-11 items-center justify-center text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 border-x border-gray-300 py-2 text-center font-bold text-gray-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Aumentar quantidade"
                      onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                      className="flex h-11 w-11 items-center justify-center text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <Factory className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                    Produção em até 5 dias úteis antes do envio
                  </span>
                </div>
              ) : null}

              <Button
                onClick={handleAddToCart}
                disabled={!selectedVariant || !selectionComplete}
                className={`flex h-14 w-full items-center justify-center gap-3 rounded-sm text-lg font-black uppercase tracking-tight transition-all duration-300 sm:h-16 ${
                  selectedVariant && selectionComplete
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-black hover:shadow-black/20"
                    : "cursor-not-allowed bg-gray-200 text-gray-400"
                }`}
              >
                <ShoppingCart className="h-6 w-6" />
                {!selectionComplete
                  ? "Selecione as opções"
                  : availableToOrder
                    ? "Adicionar ao Carrinho"
                    : "Indisponível"}
              </Button>
            </div>
          </section>
        </div>

        {specifications.length > 0 ? (
          <section className="mt-16 max-w-4xl sm:mt-24" aria-labelledby="spec-title">
            <h2
              id="spec-title"
              className="mb-8 flex items-center gap-3 text-xl font-black uppercase tracking-tighter text-gray-900 sm:text-2xl"
            >
              <span className="h-8 w-1.5 bg-red-600" />
              Especificações
            </h2>

            <Accordion type="single" collapsible defaultValue="specs" className="w-full">
              <AccordionItem value="specs" className="border-gray-200">
                <AccordionTrigger className="text-sm font-bold uppercase tracking-tight text-gray-900 transition-colors hover:text-red-600">
                  Detalhes do produto
                </AccordionTrigger>
                <AccordionContent>
                  <dl className="divide-y divide-gray-100 pt-3">
                    {specifications.map((spec, index) => (
                      <div
                        key={`${spec.label}-${index}`}
                        className="grid grid-cols-[minmax(100px,1fr)_2fr] gap-4 py-3 text-sm"
                      >
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                          {spec.label}
                        </dt>
                        <dd className="font-semibold text-gray-900">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        ) : null}

        {relatedQuery.data && relatedQuery.data.length > 0 ? (
          <section
            className="mt-16 border-t border-gray-100 pt-12 sm:mt-24"
            aria-labelledby="related-title"
          >
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">
                  Você também pode gostar
                </p>
                <h2
                  id="related-title"
                  className="mt-1 text-xl font-black uppercase tracking-tighter text-gray-900 sm:text-2xl"
                >
                  Produtos relacionados
                </h2>
              </div>
              <Link
                to="/products"
                search={{}}
                className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-red-600"
              >
                Ver catálogo
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {relatedQuery.data.slice(0, 8).map((related) => (
                <ProductCard
                  key={related.id}
                  id={related.id}
                  slug={related.slug}
                  name={related.name}
                  price={related.price}
                  promotionalPrice={related.promotional_price}
                  imageUrl={related.displayImageUrl}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Valor por peça
            </p>
            <p className="truncate text-lg font-black text-gray-950">
              {currency.format(finalUnitPrice)}
            </p>
          </div>
          <Button
            onClick={handleAddToCart}
            disabled={!selectedVariant || !selectionComplete || !purchaseConfig}
            className="h-12 flex-[1.35] rounded-xl bg-red-600 px-4 text-sm font-black text-white hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {!selectionComplete ? "Escolha as opções" : "Adicionar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
