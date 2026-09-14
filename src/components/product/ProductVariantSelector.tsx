import { Check, ImageOff } from "lucide-react";

import type {
  ProductOptionGroup,
  ProductVariantWithValues,
} from "@/lib/product-detail";
import { getProductGalleryItems } from "@/lib/product-images";
import type { CatalogProduct } from "@/lib/products";

interface ProductVariantSelectorProps {
  product: CatalogProduct;
  options: ProductOptionGroup[];
  variants: ProductVariantWithValues[];
  selectedVariantId: string | null;
  onSelect: (variant: ProductVariantWithValues) => void;
}

function getVariantLabel(
  variant: ProductVariantWithValues,
  options: ProductOptionGroup[],
  index: number,
) {
  const optionLabels = options.flatMap((option) => {
    const valueId = variant.optionValueIds[option.id];
    const value = option.values.find((candidate) => candidate.id === valueId);
    return value ? [value.value] : [];
  });

  return optionLabels.join(" — ") || variant.name?.trim() || `Variação ${index + 1}`;
}

export function ProductVariantSelector({
  product,
  options,
  variants,
  selectedVariantId,
  onSelect,
}: ProductVariantSelectorProps) {
  if (variants.length <= 1) return null;

  const legend = options.length === 1 ? options[0]?.name || "Variação" : "Variação";
  const required = options.some((option) => option.is_required);
  const items = variants.map((variant, index) => {
    const gallery = getProductGalleryItems(product, product.images, variant.id);
    const preview =
      gallery.find((image) => image.variantId === variant.id && image.isPrimary) ??
      gallery.find((image) => image.variantId === variant.id) ??
      gallery[0] ??
      null;

    return {
      variant,
      label: getVariantLabel(variant, options, index),
      preview,
    };
  });

  return (
    <fieldset className="border-t border-gray-100 py-6" data-variant-selector>
      <legend className="mb-3 text-xs font-black uppercase tracking-widest text-gray-800">
        {legend}
        {required ? (
          <span className="ml-1 text-red-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {items.map(({ variant, label, preview }) => {
          const selected = selectedVariantId === variant.id;

          return (
            <div
              key={variant.id}
              className="w-[104px] shrink-0 snap-start"
              data-variant-choice={variant.id}
            >
              <p
                className={`mb-2 min-h-8 text-center text-xs font-bold leading-4 ${
                  selected ? "text-gray-950" : "text-gray-600"
                }`}
                data-variant-label={variant.id}
              >
                {label}
              </p>

              <button
                type="button"
                aria-label={`Selecionar variação ${label}`}
                aria-pressed={selected}
                onClick={() => onSelect(variant)}
                data-variant-preview={variant.id}
                className={`relative aspect-square w-full overflow-hidden rounded-xl border-2 bg-gray-50 transition-[border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 active:scale-[0.98] ${
                  selected
                    ? "border-red-600 shadow-sm ring-2 ring-red-600/15"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                {preview ? (
                  <img
                    src={preview.thumbUrl}
                    alt=""
                    width={256}
                    height={256}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-contain"
                    data-variant-preview-image={variant.id}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-gray-300">
                    <ImageOff className="h-6 w-6" aria-hidden="true" />
                  </span>
                )}

                {selected ? (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-sm"
                    aria-hidden="true"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
