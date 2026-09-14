import { SizeGuideDialog } from "@/components/product/SizeGuideDialog";
import type {
  ProductCommercialType,
  ProductPurchaseConfig,
  PurchaseCustomization,
} from "@/lib/product-purchase";
import { calculatePurchaseSurcharge } from "@/lib/product-purchase";
import { getSizeGuidance, SIZE_GUIDANCE_NOTE } from "@/lib/size-guidance";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const sizeGuideTypes = new Set<ProductCommercialType>([
  "torcedor",
  "jogador",
  "feminino",
  "infantil",
  "basquete",
]);

export function ProductPurchaseOptions({
  config,
  value,
  onChange,
  commercialType,
  categoryName,
  categorySlug,
}: {
  config: ProductPurchaseConfig;
  value: PurchaseCustomization;
  onChange: (next: PurchaseCustomization) => void;
  commercialType?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
}) {
  const surcharge = calculatePurchaseSurcharge(config, value);
  const normalEnabled = Boolean(value.personalization);
  const phraseEnabled = Boolean(value.phrase);
  const totalMin = config.productionBusinessDays + config.deliveryMinBusinessDays;
  const totalMax = config.productionBusinessDays + config.deliveryMaxBusinessDays;
  const selectedPatchCodes =
    value.patchCodes?.length > 0 ? value.patchCodes : value.patchCode ? [value.patchCode] : [];
  const effectiveCommercialType = commercialType ?? config.commercialType;
  const sizeGuidance = getSizeGuidance({
    commercialType: effectiveCommercialType,
    categoryName,
    categorySlug,
  });
  const sizeGuideCommercialType = sizeGuideTypes.has(
    effectiveCommercialType as ProductCommercialType,
  )
    ? (effectiveCommercialType as ProductCommercialType)
    : config.commercialType;

  return (
    <div className="space-y-5 border-t border-gray-100 py-6">
      {config.sizeEnabled ? (
        <fieldset>
          <div className="mb-3 flex items-center justify-between gap-3">
            <legend className="text-xs font-black uppercase tracking-widest text-gray-800">
              Tamanho <span className="text-red-600">*</span>
            </legend>
            <SizeGuideDialog
              commercialType={sizeGuideCommercialType}
              triggerLabel="Ver guia de tamanhos"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {config.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ ...value, size })}
                className={`min-h-11 min-w-12 rounded-md border px-4 py-2 text-sm font-bold transition-colors ${value.size === size ? "border-red-600 bg-red-600 text-white" : "border-gray-300 bg-white text-gray-800 hover:border-red-600"}`}
              >
                {size}
              </button>
            ))}
          </div>
          <div
            className="mt-2 max-w-2xl text-xs font-medium leading-5 text-gray-500"
            data-size-guidance
            data-size-guidance-kind={sizeGuidance.kind}
            aria-live="polite"
          >
            <p data-size-guidance-instruction>{sizeGuidance.instruction}</p>
            <p className="mt-0.5 text-gray-400" data-size-guidance-note>
              {SIZE_GUIDANCE_NOTE}
            </p>
          </div>
        </fieldset>
      ) : null}

      {config.personalizationEnabled ? (
        <div>
          <label
            className="text-xs font-black uppercase tracking-widest text-gray-800"
            htmlFor="personalizar"
          >
            Personalizar
          </label>
          <select
            id="personalizar"
            className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
            value={normalEnabled ? "yes" : "no"}
            onChange={(event) =>
              onChange(
                event.target.value === "yes"
                  ? { ...value, personalization: { name: "", number: "" }, phrase: null }
                  : { ...value, personalization: null },
              )
            }
          >
            <option value="no">Não</option>
            <option value="yes">
              Sim — nome e número (+{currency.format(config.personalizationPrice)})
            </option>
          </select>
          {normalEnabled ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
              <label className="text-sm font-semibold text-gray-700">
                Nome
                <input
                  value={value.personalization?.name ?? ""}
                  maxLength={config.personalizationNameMax}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      personalization: {
                        name: event.target.value,
                        number: value.personalization?.number ?? "",
                      },
                    })
                  }
                  className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 outline-none focus:border-red-500"
                  placeholder={`Até ${config.personalizationNameMax} caracteres`}
                />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Número
                <input
                  inputMode="numeric"
                  maxLength={3}
                  value={value.personalization?.number ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      personalization: {
                        name: value.personalization?.name ?? "",
                        number: event.target.value.replace(/\D/g, "").slice(0, 3),
                      },
                    })
                  }
                  className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 outline-none focus:border-red-500"
                  placeholder="Ex.: 10"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {config.patches.length > 0 ? (
        <fieldset>
          <legend className="text-xs font-black uppercase tracking-widest text-gray-800">
            Patches
          </legend>
          <p className="mt-1 text-xs text-gray-500">
            Você pode escolher mais de um. Cada patch custa{" "}
            {currency.format(config.patchDefaultPrice)}.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {config.patches.map((patch) => {
              const checked = selectedPatchCodes.includes(patch.code);
              return (
                <label
                  key={patch.code}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm font-semibold transition ${checked ? "border-red-500 bg-red-50 text-red-900" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...new Set([...selectedPatchCodes, patch.code])]
                        : selectedPatchCodes.filter((code) => code !== patch.code);
                      onChange({ ...value, patchCodes: next, patchCode: next[0] ?? null });
                    }}
                    className="h-4 w-4 rounded border-gray-300 accent-red-600"
                  />
                  <span className="min-w-0 flex-1">{patch.label}</span>
                  <span className="shrink-0 text-xs text-gray-500">
                    +{currency.format(patch.price)}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-amber-700">
            Só mostramos patches compatíveis com este produto, competição e temporada.
          </p>
        </fieldset>
      ) : null}

      {config.phraseEnabled && !normalEnabled ? (
        <div>
          <label
            className="text-xs font-black uppercase tracking-widest text-gray-800"
            htmlFor="frase-personalizada"
          >
            Frase personalizada
          </label>
          <select
            id="frase-personalizada"
            className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
            value={phraseEnabled ? "yes" : "no"}
            onChange={(event) =>
              onChange(
                event.target.value === "yes"
                  ? { ...value, phrase: " ", personalization: null }
                  : { ...value, phrase: null },
              )
            }
          >
            <option value="no">Não</option>
            <option value="yes">Sim — frase (+{currency.format(config.phrasePrice)})</option>
          </select>
          {phraseEnabled ? (
            <label className="mt-3 block text-sm font-semibold text-gray-700">
              Frase personalizada
              <textarea
                maxLength={config.phraseMax}
                value={value.phrase?.trimStart() ?? ""}
                onChange={(event) => onChange({ ...value, phrase: event.target.value })}
                className="mt-1 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-red-500"
                placeholder={`Até ${config.phraseMax} caracteres, sem números`}
              />
              <span className="mt-1 block text-right text-xs font-medium text-gray-400">
                {value.phrase?.trimStart().length ?? 0}/{config.phraseMax}
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {surcharge > 0 ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          Adicionais desta peça: +{currency.format(surcharge)}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
        <strong className="block text-gray-900">
          Prazo total estimado:{" "}
          {totalMin === totalMax
            ? `${totalMax} dias úteis`
            : `${totalMin} a ${totalMax} dias úteis`}
          .
        </strong>
        Inclui até {config.productionBusinessDays} dias úteis de preparação e{" "}
        {config.deliveryMinBusinessDays} a {config.deliveryMaxBusinessDays} dias úteis de
        transporte. O prazo pode variar conforme a localidade.
      </div>
    </div>
  );
}
