import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchProductPurchaseAdmin,
  fetchPurchaseGlobal,
  fetchPurchaseProductsPage,
  saveProductPurchaseSettings,
  savePurchaseGlobal,
  type PurchaseGlobalAdmin,
  type PurchaseProductAdmin,
  type PurchaseProductPage,
} from "@/lib/admin-product-purchase";
import type { ProductCommercialType } from "@/lib/product-purchase";

const PAGE_SIZE = 25;

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
  const [globalDraft, setGlobalDraft] = useState<PurchaseGlobalAdmin | null>(null);
  const [productPage, setProductPage] = useState<PurchaseProductPage | null>(null);
  const [productDraft, setProductDraft] = useState<PurchaseProductAdmin | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadGlobal() {
    setGlobalDraft(await fetchPurchaseGlobal());
  }

  async function loadProducts() {
    setProductPage(await fetchPurchaseProductsPage({ query, page, pageSize: PAGE_SIZE }));
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchPurchaseGlobal(),
      fetchPurchaseProductsPage({ query, page, pageSize: PAGE_SIZE }),
    ])
      .then(([global, products]) => {
        if (!active) return;
        setGlobalDraft(global);
        setProductPage(products);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar as regras de venda.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query]);

  const selectedId = productDraft?.productId ?? "";
  const pageProducts = productPage?.items ?? [];

  const selectedInPage = useMemo(
    () => pageProducts.some((product) => product.productId === selectedId),
    [pageProducts, selectedId],
  );

  async function selectProduct(productId: string) {
    if (!productId) {
      setProductDraft(null);
      return;
    }
    setLoadingProduct(true);
    setError("");
    try {
      setProductDraft(await fetchProductPurchaseAdmin(productId));
    } catch {
      setError("Não foi possível carregar as regras deste produto.");
    } finally {
      setLoadingProduct(false);
    }
  }

  async function saveGlobalRules() {
    if (!globalDraft || saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      setGlobalDraft(await savePurchaseGlobal(globalDraft));
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
      const saved = await saveProductPurchaseSettings(productDraft);
      setProductDraft(saved);
      await Promise.all([loadGlobal(), loadProducts()]);
      setMessage("Regras do produto atualizadas.");
    } catch {
      setError("Não foi possível salvar as regras deste produto.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="mt-8 flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando regras de venda...
      </section>
    );
  }

  if (!globalDraft) {
    return (
      <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "Regras de venda indisponíveis."}
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-6 border-t border-gray-200 pt-8">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-gray-950">
          Tamanhos, personalização e patches
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          As regras continuam globais, mas a seleção de produtos agora é buscada e paginada no
          banco.
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
        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPage(1);
                setQuery(queryInput.trim());
              }
            }}
            placeholder="Buscar produto por nome, time, marca..."
            className="h-10 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-red-500"
          />
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setQuery(queryInput.trim());
            }}
            className="h-10 rounded-md border border-gray-300 px-4 text-sm font-bold"
          >
            Buscar
          </button>
          <select
            value={selectedInPage ? selectedId : ""}
            onChange={(event) => void selectProduct(event.target.value)}
            className="h-10 min-w-[280px] rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-red-500"
          >
            <option value="">Selecione um produto desta página</option>
            {pageProducts.map((product) => (
              <option key={product.productId} value={product.productId}>
                {product.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="inline-flex h-8 items-center rounded border px-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            {productPage?.total ?? 0} produtos · página {productPage?.page ?? page}/
            {Math.max(1, productPage?.totalPages ?? 1)}
          </span>
          <button
            type="button"
            disabled={!productPage || page >= productPage.totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="inline-flex h-8 items-center rounded border px-2 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {loadingProduct ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando produto...
          </div>
        ) : productDraft ? (
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
              </label>
              <div className="space-y-2 text-sm font-semibold">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={productDraft.sizeEnabled}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, sizeEnabled: event.target.checked })
                    }
                  />
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
                  />
                  Permitir personalização comum
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={productDraft.phraseEnabled}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, phraseEnabled: event.target.checked })
                    }
                  />
                  Permitir frase personalizada
                </label>
              </div>
            </div>

            <div>
              <h4 className="font-black text-gray-950">Patches disponíveis neste produto</h4>
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
                        />
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
