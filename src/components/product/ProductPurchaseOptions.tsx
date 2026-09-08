import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProductPurchaseConfig, PurchaseCustomization } from "@/lib/product-purchase";
import { calculatePurchaseSurcharge } from "@/lib/product-purchase";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function SizeGuide({ sizes }: { sizes: string[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-xs font-bold text-red-600 underline-offset-4 hover:underline">
          Ver guia de tamanhos
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl bg-white">
        <DialogHeader>
          <DialogTitle>Guia de tamanhos</DialogTitle>
          <DialogDescription>
            Use uma camisa que já veste bem como referência antes de escolher.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm text-gray-600">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4">
            <div>
              <strong className="block text-gray-950">Largura</strong>
              <span className="text-xs leading-5">Meça de uma axila à outra com a peça esticada.</span>
            </div>
            <div>
              <strong className="block text-gray-950">Comprimento</strong>
              <span className="text-xs leading-5">Meça do ponto mais alto do ombro até a barra.</span>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Tamanhos disponíveis neste produto</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => (
                <span key={size} className="min-w-11 rounded-md border border-gray-200 bg-white px-3 py-2 text-center text-xs font-black text-gray-900">{size}</span>
              ))}
            </div>
          </div>
          <p className="text-xs leading-5 text-gray-500">
            As medidas em centímetros podem variar entre modelos. Quando houver uma tabela específica da peça, ela prevalece. Se estiver entre dois tamanhos e preferir caimento mais folgado, escolha o maior.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProductPurchaseOptions({ config, value, onChange }: { config: ProductPurchaseConfig; value: PurchaseCustomization; onChange: (next: PurchaseCustomization) => void }) {
  const surcharge = calculatePurchaseSurcharge(config, value);
  const normalEnabled = Boolean(value.personalization);
  const phraseEnabled = Boolean(value.phrase);
  const totalMin = config.productionBusinessDays + config.deliveryMinBusinessDays;
  const totalMax = config.productionBusinessDays + config.deliveryMaxBusinessDays;

  return (
    <div className="space-y-5 border-t border-gray-100 py-6">
      {config.sizeEnabled ? (
        <fieldset>
          <div className="mb-3 flex items-center justify-between gap-3">
            <legend className="text-xs font-black uppercase tracking-widest text-gray-800">
              Tamanho <span className="text-red-600">*</span>
            </legend>
            <SizeGuide sizes={config.sizes} />
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
          <p className="mt-2 text-xs font-medium text-gray-500">O tamanho não altera o preço do produto.</p>
        </fieldset>
      ) : null}

      {config.personalizationEnabled ? (
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-gray-800" htmlFor="personalizar">Personalizar</label>
          <select
            id="personalizar"
            className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
            value={normalEnabled ? "yes" : "no"}
            onChange={(event) => onChange(event.target.value === "yes" ? { ...value, personalization: { name: "", number: "" }, phrase: null } : { ...value, personalization: null })}
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
                  onChange={(event) => onChange({ ...value, personalization: { name: event.target.value, number: value.personalization?.number ?? "" } })}
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
                  onChange={(event) => onChange({ ...value, personalization: { name: value.personalization?.name ?? "", number: event.target.value.replace(/\D/g, "").slice(0, 3) } })}
                  className="mt-1 h-11 w-full rounded-md border border-gray-300 px-3 outline-none focus:border-red-500"
                  placeholder="Ex.: 10"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <label className="text-xs font-black uppercase tracking-widest text-gray-800" htmlFor="patch">Patch</label>
        <select
          id="patch"
          className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
          value={value.patchCode ?? ""}
          onChange={(event) => onChange({ ...value, patchCode: event.target.value || null })}
        >
          <option value="">Sem patch</option>
          {config.patches.map((patch) => <option key={patch.code} value={patch.code}>{patch.label} (+{currency.format(patch.price)})</option>)}
        </select>
        <p className="mt-2 text-xs text-amber-700">Escolha com atenção: os patches disponíveis variam conforme o produto.</p>
      </div>

      {config.phraseEnabled ? (
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-gray-800" htmlFor="frase-personalizada">Frase personalizada</label>
          <select
            id="frase-personalizada"
            className="mt-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-red-500"
            value={phraseEnabled ? "yes" : "no"}
            onChange={(event) => onChange(event.target.value === "yes" ? { ...value, phrase: " ", personalization: null } : { ...value, phrase: null })}
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
              <span className="mt-1 block text-right text-xs font-medium text-gray-400">{value.phrase?.trimStart().length ?? 0}/{config.phraseMax}</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {surcharge > 0 ? <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">Adicionais desta peça: +{currency.format(surcharge)}</div> : null}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
        <strong className="block text-gray-900">Prazo total estimado: {totalMin === totalMax ? `${totalMax} dias úteis` : `${totalMin} a ${totalMax} dias úteis`}.</strong>
        Inclui até {config.productionBusinessDays} dias úteis de preparação e {config.deliveryMinBusinessDays} a {config.deliveryMaxBusinessDays} dias úteis de transporte. O prazo pode variar conforme a localidade.
      </div>
    </div>
  );
}
