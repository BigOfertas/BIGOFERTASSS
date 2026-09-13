import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  PencilLine,
  Tags,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  FINANCE_COMMERCIAL_LABELS,
  FINANCE_COMMERCIAL_TYPES,
  applyFinanceCategory,
  fetchFinanceCategorySettings,
  fetchFinanceVariantTargetsPage,
  saveFinanceVariant,
  type FinanceCategoryRow,
  type FinanceCommercialType,
  type FinanceVariantPage,
  type FinanceVariantRow,
} from "@/lib/admin-finance-categories";

const PAGE_SIZE = 25;

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoney(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function inputValue(value: number | null) {
  return value === null ? "" : value.toFixed(2);
}

type CategoryEdit = {
  row: FinanceCategoryRow;
  changePrice: boolean;
  changeCost: boolean;
  price: string;
  cost: string;
};

type VariantDraft = {
  commercialType: FinanceCommercialType | "other" | "inherit";
  salePrice: string;
  unitCost: string;
};

function CategoryDialog({
  edit,
  saving,
  onCancel,
  onApply,
  onChange,
}: {
  edit: CategoryEdit;
  saving: boolean;
  onCancel: () => void;
  onApply: () => void;
  onChange: (next: CategoryEdit) => void;
}) {
  const parsedPrice = parseMoney(edit.price);
  const parsedCost = parseMoney(edit.cost);
  const invalid =
    (!edit.changePrice && !edit.changeCost) ||
    (edit.changePrice && parsedPrice === null) ||
    (edit.changeCost && parsedCost === null);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-category-dialog-title"
        className="w-full max-w-lg rounded-2xl border border-white/80 bg-white p-5 shadow-2xl sm:p-6"
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Aplicar a todos</p>
        <h3 id="finance-category-dialog-title" className="mt-1 text-xl font-black text-gray-950">
          Atualizar categoria {edit.row.label}?
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Esta operação alcança {edit.row.targetCount} variações em {edit.row.productCount} produtos
          atualmente classificados neste grupo.
        </p>

        <div className="mt-5 space-y-3">
          <label className="flex gap-3 rounded-xl border border-gray-200 p-4">
            <input
              type="checkbox"
              checked={edit.changePrice}
              onChange={(event) => onChange({ ...edit, changePrice: event.target.checked })}
              className="mt-1 h-4 w-4 accent-red-600"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-gray-950">Preço de venda</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                Atual: {money(edit.row.salePrice)}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={!edit.changePrice}
                value={edit.price}
                onChange={(event) => onChange({ ...edit, price: event.target.value })}
                className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-semibold outline-none focus:border-red-500 disabled:bg-gray-50 disabled:text-gray-400"
                aria-label={`Novo preço de ${edit.row.label}`}
              />
            </span>
          </label>

          <label className="flex gap-3 rounded-xl border border-gray-200 p-4">
            <input
              type="checkbox"
              checked={edit.changeCost}
              onChange={(event) => onChange({ ...edit, changeCost: event.target.checked })}
              className="mt-1 h-4 w-4 accent-red-600"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-gray-950">Custo atual</span>
              <span className="mt-0.5 block text-xs text-gray-500">
                Atual: {money(edit.row.unitCost)}
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={!edit.changeCost}
                value={edit.cost}
                onChange={(event) => onChange({ ...edit, cost: event.target.value })}
                className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-semibold outline-none focus:border-red-500 disabled:bg-gray-50 disabled:text-gray-400"
                aria-label={`Novo custo de ${edit.row.label}`}
              />
            </span>
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
          Esta alteração será usada somente em novas vendas. Pedidos já realizados não serão
          modificados. Ao aplicar um novo custo geral, exceções individuais atuais deste grupo são
          substituídas de propósito.
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-bold text-gray-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || invalid}
            onClick={onApply}
            className="inline-flex h-10 items-center rounded-lg bg-gray-950 px-4 text-sm font-black text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aplicar alteração
          </button>
        </div>
      </div>
    </div>
  );
}

function VariantEditor({
  page,
  drafts,
  savingId,
  onDraft,
  onSave,
}: {
  page: FinanceVariantPage | null;
  drafts: Record<string, VariantDraft>;
  savingId: string;
  onDraft: (row: FinanceVariantRow, next: VariantDraft) => void;
  onSave: (row: FinanceVariantRow) => void;
}) {
  if (!page || page.items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-gray-500">Nenhuma variação encontrada.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1020px] w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50/70 text-[11px] uppercase tracking-[0.08em] text-gray-500">
          <tr>
            <th className="px-4 py-3">Produto / variação</th>
            <th className="px-4 py-3">Categoria comercial</th>
            <th className="px-4 py-3">Preço de venda</th>
            <th className="px-4 py-3">Custo</th>
            <th className="px-4 py-3 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {page.items.map((row) => {
            const draft = drafts[row.variantId] ?? {
              commercialType: row.explicitCommercialType ?? "inherit",
              salePrice: inputValue(row.salePrice),
              unitCost: inputValue(row.unitCost),
            };
            const saving = savingId === row.variantId;
            return (
              <tr key={row.variantId} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-extrabold text-gray-950">{row.productName}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {row.variantName || "Variação padrão"} · {row.sku}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <select
                    value={draft.commercialType}
                    onChange={(event) =>
                      onDraft(row, {
                        ...draft,
                        commercialType: event.target.value as VariantDraft["commercialType"],
                      })
                    }
                    className="h-9 min-w-48 rounded-lg border border-gray-300 bg-white px-2 text-xs font-bold outline-none focus:border-red-500"
                  >
                    <option value="inherit">
                      Herdar do produto ({
                        row.commercialType === "other"
                          ? "Outro"
                          : FINANCE_COMMERCIAL_LABELS[row.commercialType as FinanceCommercialType]
                      })
                    </option>
                    {FINANCE_COMMERCIAL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {FINANCE_COMMERCIAL_LABELS[type]}
                      </option>
                    ))}
                    <option value="other">Outro / sem grupo</option>
                  </select>
                </td>
                <td className="px-4 py-4">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.salePrice}
                    onChange={(event) => onDraft(row, { ...draft, salePrice: event.target.value })}
                    className="h-9 w-28 rounded-lg border border-gray-300 px-2 text-sm font-semibold outline-none focus:border-red-500"
                    aria-label={`Preço de ${row.productName}`}
                  />
                </td>
                <td className="px-4 py-4">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.unitCost}
                    onChange={(event) => onDraft(row, { ...draft, unitCost: event.target.value })}
                    className="h-9 w-28 rounded-lg border border-gray-300 px-2 text-sm font-semibold outline-none focus:border-red-500"
                    aria-label={`Custo de ${row.productName}`}
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    {row.hasCostOverride ? "Exceção individual" : "Herdado da categoria"}
                  </p>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onSave(row)}
                    className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-3 text-xs font-black text-gray-800 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                  >
                    {saving ? (
                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Salvar individual
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FinanceCategoryPricing() {
  const [categories, setCategories] = useState<FinanceCategoryRow[]>([]);
  const [variantPage, setVariantPage] = useState<FinanceVariantPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [edit, setEdit] = useState<CategoryEdit | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FinanceCommercialType | "other" | "">("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, VariantDraft>>({});
  const [savingId, setSavingId] = useState("");

  async function loadCategories() {
    const result = await fetchFinanceCategorySettings();
    setCategories(result.categories);
  }

  async function loadVariants(nextPage = page) {
    const result = await fetchFinanceVariantTargetsPage({
      query,
      commercialType: typeFilter,
      page: nextPage,
      pageSize: PAGE_SIZE,
    });
    setVariantPage(result);
    setDrafts({});
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchFinanceCategorySettings(),
      fetchFinanceVariantTargetsPage({
        query,
        commercialType: typeFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    ])
      .then(([categoryResult, variantResult]) => {
        if (!active) return;
        setCategories(categoryResult.categories);
        setVariantPage(variantResult);
        setDrafts({});
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar os preços e custos por categoria.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, typeFilter]);

  const totalTargets = useMemo(
    () => categories.reduce((sum, category) => sum + category.targetCount, 0),
    [categories],
  );

  function openCategory(row: FinanceCategoryRow) {
    setSuccess("");
    setError("");
    setEdit({
      row,
      changePrice: false,
      changeCost: false,
      price: inputValue(row.salePrice),
      cost: inputValue(row.unitCost),
    });
  }

  async function applyCategoryEdit() {
    if (!edit || savingCategory) return;
    const salePrice = edit.changePrice ? parseMoney(edit.price) : null;
    const unitCost = edit.changeCost ? parseMoney(edit.cost) : null;
    if ((edit.changePrice && salePrice === null) || (edit.changeCost && unitCost === null)) {
      setError("Revise os valores informados.");
      return;
    }

    setSavingCategory(true);
    setError("");
    setSuccess("");
    try {
      const result = await applyFinanceCategory({
        commercialType: edit.row.commercialType,
        salePrice,
        unitCost,
      });
      setEdit(null);
      await Promise.all([loadCategories(), loadVariants()]);
      setSuccess(
        `Valores atualizados com sucesso. ${result.targetCount} variações em ${result.productCount} produtos da categoria ${edit.row.label} foram atualizadas. Os novos valores serão utilizados somente em vendas futuras.`,
      );
    } catch {
      setError("Não foi possível aplicar a alteração em massa.");
    } finally {
      setSavingCategory(false);
    }
  }

  function updateDraft(row: FinanceVariantRow, next: VariantDraft) {
    setDrafts((current) => ({ ...current, [row.variantId]: next }));
  }

  async function saveIndividual(row: FinanceVariantRow) {
    if (savingId) return;
    const draft = drafts[row.variantId] ?? {
      commercialType: row.explicitCommercialType ?? "inherit",
      salePrice: inputValue(row.salePrice),
      unitCost: inputValue(row.unitCost),
    };
    const salePrice = parseMoney(draft.salePrice);
    const unitCost = parseMoney(draft.unitCost);
    if (salePrice === null || (draft.unitCost.trim() && unitCost === null)) {
      setError("Revise o preço e o custo desta variação.");
      return;
    }

    setSavingId(row.variantId);
    setError("");
    setSuccess("");
    try {
      await saveFinanceVariant({
        variantId: row.variantId,
        commercialType: draft.commercialType,
        salePrice,
        unitCost,
      });
      await Promise.all([loadCategories(), loadVariants()]);
      setSuccess(
        `Exceção individual de ${row.productName}${row.variantName ? ` — ${row.variantName}` : ""} salva. Ela vale somente para vendas futuras.`,
      );
    } catch {
      setError("Não foi possível salvar esta alteração individual.");
    } finally {
      setSavingId("");
    }
  }

  if (loading) {
    return (
      <section className="mb-8 flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando preços e custos por categoria...
      </section>
    );
  }

  return (
    <section className="mb-8 space-y-6" data-finance-category-pricing>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Administração rápida</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950">
              Preços e custos por categoria
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Altere preço, custo ou ambos para um grupo inteiro. A classificação comercial real do
              catálogo é usada; nenhuma categoria é deduzida pelo nome do produto.
            </p>
          </div>
          <div className="rounded-xl bg-gray-950 px-4 py-3 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">Itens classificados</p>
            <p className="mt-0.5 text-xl font-black">{totalTargets}</p>
          </div>
        </div>

        {success ? (
          <div className="mt-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800">
            <CheckCircle2 className="mt-1 h-4 w-4 flex-none" />
            <span>{success}</span>
          </div>
        ) : null}
        {error ? (
          <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((row) => (
            <article key={row.commercialType} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-gray-950">{row.label}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {row.targetCount} variações · {row.productCount} produtos
                  </p>
                </div>
                <Tags className="h-4 w-4 text-gray-300" aria-hidden="true" />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">Preço geral</dt>
                  <dd className="mt-1 text-sm font-black text-gray-950">{money(row.salePrice)}</dd>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">Custo geral</dt>
                  <dd className="mt-1 text-sm font-black text-gray-950">{money(row.unitCost)}</dd>
                </div>
              </dl>
              {row.individualCostOverrides > 0 ? (
                <p className="mt-3 text-[11px] font-semibold text-amber-700">
                  {row.individualCostOverrides} exceções de custo individuais agora
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => openCategory(row)}
                className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg bg-gray-950 px-3 text-xs font-black text-white hover:bg-red-600"
              >
                Alterar valores
              </button>
            </article>
          ))}
        </div>

        <p className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold leading-5 text-gray-600">
          Regra de histórico: alterações gerais e individuais afetam somente novas compras. O preço,
          custo, lucro e participação de 5% dos pedidos já realizados continuam preservados nos
          snapshots financeiros do pedido.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-5 sm:p-6">
          <h3 className="text-lg font-black text-gray-950">Exceções individuais por produto/variação</h3>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Use aqui quando uma peça específica fugir do valor geral. Em produtos com versões
            Torcedor/Jogador, cada variante pode ter sua própria classificação, preço e custo.
          </p>
          <div className="mt-4 flex flex-col gap-2 lg:flex-row">
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setPage(1);
                  setQuery(queryInput.trim());
                }
              }}
              placeholder="Buscar produto ou SKU..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-red-500"
            />
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setQuery(queryInput.trim());
              }}
              className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-black text-gray-700"
            >
              Buscar
            </button>
            <select
              value={typeFilter}
              onChange={(event) => {
                setPage(1);
                setTypeFilter(event.target.value as typeof typeFilter);
              }}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-bold outline-none focus:border-red-500"
            >
              <option value="">Todas as categorias</option>
              {FINANCE_COMMERCIAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FINANCE_COMMERCIAL_LABELS[type]}
                </option>
              ))}
              <option value="other">Outro / sem grupo</option>
            </select>
          </div>
        </div>

        <VariantEditor
          page={variantPage}
          drafts={drafts}
          savingId={savingId}
          onDraft={updateDraft}
          onSave={(row) => void saveIndividual(row)}
        />

        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="inline-flex h-8 items-center rounded-lg border border-gray-300 px-2 font-bold disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span>
            {variantPage?.total ?? 0} variações · página {variantPage?.page ?? page}/
            {Math.max(1, variantPage?.totalPages ?? 1)}
          </span>
          <button
            type="button"
            disabled={!variantPage || page >= variantPage.totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="inline-flex h-8 items-center rounded-lg border border-gray-300 px-2 font-bold disabled:opacity-40"
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {edit ? (
        <CategoryDialog
          edit={edit}
          saving={savingCategory}
          onCancel={() => setEdit(null)}
          onApply={() => void applyCategoryEdit()}
          onChange={setEdit}
        />
      ) : null}
    </section>
  );
}
