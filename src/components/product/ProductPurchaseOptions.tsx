import type { ProductPurchaseConfig, PurchaseCustomization } from "@/lib/product-purchase";
import { calculatePurchaseSurcharge } from "@/lib/product-purchase";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ProductPurchaseOptions({
  config,
  value,
  onChange,
}: {
  config: ProductPurchaseConfig;
  value: PurchaseCustomization;
  onChange: (next: PurchaseCustomization) => void;
}) {
  const surcharge = calculatePurchaseSurcharge(config, value);
  const normalEnabled = Boolean(value.personalization);
  const phraseEnabled = Boolean(value.phrase);

  return (
    <div className="space-y-5 border-t border-gray-100 py-6">
      {config.sizeEnabled ? (
        <fieldset>
          <legend className="mb-3 text-xs font-black uppercase tracking-widest text-gray-800">
            Tamanho <span className="text-red-600">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {config.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ ...value, size })}
                className={`min-h-11 min-w-12 rounded-md border px-4 py-2 text-sm font-bold transition-colors ${
                  value.size === size
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gray-300 bg-white text-gray-800 hover:border-red-600"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-gray-500">
            O tamanho não altera o preço do produto.
          </p>
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
            <option value="yes">Sim (+{currency.format(config.personalizationPrice)})</option>
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

      <div>
        <label
          className="text-xs font-black uppercase tracking-widest text-gray-800"
          htmlFor="patch"
        >
          Patch
        </label>
        <select
          id="patch"
          className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
          value={value.patchCode ?? ""}
          onChange={(event) => onChange({ ...value, patchCode: event.target.value || null })}
        >
          <option value="">Sem patch</option>
          {config.patches.map((patch) => (
            <option key={patch.code} value={patch.code}>
              {patch.label} (+{currency.format(patch.price)})
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-amber-700">
          Escolha com atenção: os patches disponíveis variam conforme o produto.
        </p>
      </div>

      {config.phraseEnabled ? (
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
            <option value="yes">Sim (+{currency.format(config.phrasePrice)})</option>
          </select>
          {phraseEnabled ? (
            <label className="mt-3 block text-sm font-semibold text-gray-700">
              Frase personalizada
              <textarea
                maxLength={config.phraseMax}
                value={value.phrase?.trimStart() ?? ""}
                onChange={(event) => onChange({ ...value, phrase: event.target.value })}
                className="mt-1 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-red-500"
                placeholder={`Até ${config.phraseMax} caracteres, sem número separado`}
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
        <strong className="text-gray-900">Prazo:</strong> preparação em até{" "}
        {config.productionBusinessDays} dias úteis após a confirmação do pagamento. Entrega estimada
        em {config.deliveryMinBusinessDays} a {config.deliveryMaxBusinessDays} dias úteis, podendo
        variar conforme a localidade.
      </div>
    </div>
  );
}
