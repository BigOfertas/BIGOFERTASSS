import { useEffect, useMemo, useState } from "react";
import {
  fetchPurchaseAdminSnapshot,
  saveProductPurchaseSettings,
  savePurchaseGlobal,
  type PurchaseAdminSnapshot,
  type PurchaseProductAdmin,
} from "@/lib/admin-product-purchase";
import type { ProductCommercialType } from "@/lib/product-purchase";

const TYPE_LABELS: Array<[ProductCommercialType, string]> = [
  ["torcedor", "Modelo torcedor"],
  ["feminino", "Modelo feminino"],
  ["jogador", "Modelo jogador"],
  ["retro", "Retrô"],
  ["infantil", "Infantil"],
  ["calcao", "Calção"],
  ["basquete", "Basquete"],
  ["other", "Outro / preço manual"],
];

function numberInput(value: number, onChange: (value: number) => void) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-red-500"
    />
  );
}

export function ProductPurchaseAdmin() {
  const [snapshot, setSnapshot] = useState<PurchaseAdminSnapshot | null>(null);
  const [globalDraft, setGlobalDraft] = useState<PurchaseAdminSnapshot["global"] | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productDraft, setProductDraft] = useState<PurchaseProductAdmin | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await fetchPurchaseAdminSnapshot();
      setSnapshot(data);
      setGlobalDraft(data.global);
    } catch {
      setError("Não foi possível carregar as regras de tamanhos, personalização e patches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (snapshot?.products ?? []).filter(
      (product) => !term || `${product.name} ${product.sku}`.toLowerCase().includes(term),
    );
  }, [search, snapshot?.products]);

  useEffect(() => {
    if (!selectedProductId || !snapshot) {
      setProductDraft(null);
      return;
    }
    const found =
      snapshot.products.find((product) => product.productId === selectedProductId) ?? null;
    setProductDraft(
      found ? { ...found, patches: found.patches.map((patch) => ({ ...patch })) } : null,
    );
  }, [selectedProductId, snapshot]);

  async function saveGlobalRules() {
    if (!globalDraft || saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const data = await savePurchaseGlobal(globalDraft);
      setSnapshot(data);
      setGlobalDraft(data.global);
      setMessage("Regras gerais atualizadas.");
    } catch {
      setError("Não foi possível salvar as regras gerais.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProductRules() {
    if (!productDraft || saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const data = await saveProductPurchaseSettings(productDraft);
      setSnapshot(data);
      setGlobalDraft(data.global);
      setMessage("Regras do produto atualizadas.");
    } catch {
      setError("Não foi possível salvar as regras deste produto.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Carregando regras de venda...
      </section>
    );
  if (!snapshot || !globalDraft)
    return (
      <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "Regras de venda indisponíveis."}
      </section>
    );

  return (
    <section className="mt-8 space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-gray-950">
          Tamanhos, personalização e patches
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Edite os valores gerais da loja e, abaixo, escolha exatamente o que cada produto oferece.
        </p>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-black text-gray-950">Regras gerais</h3>
        <p className="mt-1 text-sm text-gray-500">
          Tamanhos fixos: P, M, G, GG, 2GG, 3GG e 4XL. Tamanho nunca muda o preço.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold">
            Personalização comum (R$)
            {numberInput(globalDraft.personalizationPrice, (value) =>
              setGlobalDraft({ ...globalDraft, personalizationPrice: value }),
            )}
          </label>
          <label className="text-sm font-semibold">
            Limite do nome
            {numberInput(globalDraft.personalizationNameMax, (value) =>
              setGlobalDraft({ ...globalDraft, personalizationNameMax: Math.round(value) }),
            )}
          </label>
          <label className="text-sm font-semibold">
            Frase estendida (R$)
            {numberInput(globalDraft.phrasePrice, (value) =>
              setGlobalDraft({ ...globalDraft, phrasePrice: value }),
            )}
          </label>
          <label className="text-sm font-semibold">
            Limite da frase
            {numberInput(globalDraft.phraseMax, (value) =>
              setGlobalDraft({ ...globalDraft, phraseMax: Math.round(value) }),
            )}
          </label>
          <label className="text-sm font-semibold">
            Patch padrão (R$)
            {numberInput(globalDraft.patchDefaultPrice, (value) =>
              setGlobalDraft({ ...globalDraft, patchDefaultPrice: value }),
            )}
          </label>
          <label className="text-sm font-semibold">
            Preparação (dias úteis)
            {numberInput(globalDraft.productionBusinessDays, (value) =>
              setGlobalDraft({ ...globalDraft, productionBusinessDays: Math.round(value) }),
            )}
          </label>
          <label className="text-sm font-semibold">
            Entrega mínima (dias úteis)
            {numberInput(globalDraft.deliveryMinBusinessDays, (value) =>
              setGlobalDraft({ ...globalDraft, deliveryMinBusinessDays: Math.round(value) }),
            )}
          </label>
          <label className="text-sm font-semibold">
            Entrega máxima (dias úteis)
            {numberInput(globalDraft.deliveryMaxBusinessDays, (value) =>
              setGlobalDraft({ ...globalDraft, deliveryMaxBusinessDays: Math.round(value) }),
            )}
          </label>
        </div>

        <h4 className="mt-6 font-black text-gray-950">Preço fixo por modelo</h4>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TYPE_LABELS.filter(([type]) => type !== "other").map(([type, label]) => (
            <label key={type} className="text-sm font-semibold">
              {label} (R$)
              {numberInput(globalDraft.productTypePrices[type] ?? 0, (value) =>
                setGlobalDraft({
                  ...globalDraft,
                  productTypePrices: { ...globalDraft.productTypePrices, [type]: value },
                }),
              )}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveGlobalRules()}
          className="mt-6 h-10 rounded-lg bg-gray-950 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
        >
          Salvar regras gerais
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h3 className="text-lg font-black text-gray-950">Configuração individual por produto</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto por nome ou SKU"
            className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-red-500"
          />
          <select
            value={selectedProductId}
            onChange={(event) => setSelectedProductId(event.target.value)}
            className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-red-500"
          >
            <option value="">Selecione um produto</option>
            {filteredProducts.map((product) => (
              <option key={product.productId} value={product.productId}>
                {product.name} — {product.sku}
              </option>
            ))}
          </select>
        </div>

        {productDraft ? (
          <div className="mt-5 space-y-5 border-t border-gray-100 pt-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold">
                Modelo comercial
                <select
                  value={productDraft.commercialType}
                  onChange={(event) =>
                    setProductDraft({
                      ...productDraft,
                      commercialType: event.target.value as ProductCommercialType,
                    })
                  }
                  className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                >
                  {TYPE_LABELS.map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-gray-500">
                  Ao salvar um modelo conhecido, o preço-base do produto recebe automaticamente o
                  valor geral desse modelo.
                </span>
              </label>
              <div className="space-y-2 text-sm font-semibold">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={productDraft.sizeEnabled}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, sizeEnabled: event.target.checked })
                    }
                  />{" "}
                  Exigir tamanho
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={productDraft.personalizationEnabled}
                    onChange={(event) =>
                      setProductDraft({
                        ...productDraft,
                        personalizationEnabled: event.target.checked,
                      })
                    }
                  />{" "}
                  Permitir personalização comum
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={productDraft.phraseEnabled}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, phraseEnabled: event.target.checked })
                    }
                  />{" "}
                  Permitir frase personalizada
                </label>
              </div>
            </div>

            <div>
              <h4 className="font-black text-gray-950">Patches disponíveis neste produto</h4>
              <p className="mt-1 text-xs text-gray-500">
                Marque somente campeonatos que fazem sentido para a peça. O preço vazio usa o padrão
                geral.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {globalDraft.patchCatalog.map((patch) => {
                  const current = productDraft.patches.find((item) => item.code === patch.code);
                  const enabled = Boolean(current?.enabled ?? current);
                  return (
                    <div key={patch.code} className="rounded-lg border border-gray-200 p-3">
                      <label className="flex items-center gap-2 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(event) => {
                            const others = productDraft.patches.filter(
                              (item) => item.code !== patch.code,
                            );
                            setProductDraft({
                              ...productDraft,
                              patches: event.target.checked
                                ? [
                                    ...others,
                                    {
                                      code: patch.code,
                                      enabled: true,
                                      price: current?.price ?? null,
                                    },
                                  ]
                                : others,
                            });
                          }}
                        />{" "}
                        {patch.label}
                      </label>
                      {enabled ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={`Padrão: R$ ${globalDraft.patchDefaultPrice.toFixed(2).replace(".", ",")}`}
                          value={current?.price ?? ""}
                          onChange={(event) => {
                            const others = productDraft.patches.filter(
                              (item) => item.code !== patch.code,
                            );
                            setProductDraft({
                              ...productDraft,
                              patches: [
                                ...others,
                                {
                                  code: patch.code,
                                  enabled: true,
                                  price: event.target.value ? Number(event.target.value) : null,
                                },
                              ],
                            });
                          }}
                          className="mt-2 h-9 w-full rounded-md border border-gray-300 px-2 text-sm"
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveProductRules()}
              className="h-10 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Salvar este produto
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
