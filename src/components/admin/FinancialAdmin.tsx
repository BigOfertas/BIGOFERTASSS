import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Percent,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShoppingBag,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchFinanceProductsPage,
  fetchFinanceSettings,
  fetchFinancialDashboard,
  saveFinanceSettings,
  saveProductFinance,
  type FinanceSettings,
  type FinancialPerformanceRow,
  type FinancialPeriod,
} from "@/lib/admin-finance";
import { getUserFacingError } from "@/lib/user-facing-error";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

const PERIODS: Array<{ id: FinancialPeriod; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "previous_month", label: "Mês anterior" },
  { id: "year", label: "Este ano" },
];

const CATEGORY_LABELS: Record<string, string> = {
  torcedor: "Torcedor",
  feminina: "Feminina",
  jogador: "Jogador",
  retro: "Retrô",
  kit_infantil: "Kit Infantil",
  short_calcao: "Short / Calção",
  basquete_nba: "Basquete / NBA",
  camisa_calcao: "Camisa + Calção",
  regata_calcao: "Regata + Calção",
  treino_calca: "Camisa/Top de Treino + Calça",
  casaco_calca: "Casaco + Calça",
  corta_vento: "Corta-vento",
  outro: "Outros",
};

const SNAPSHOT_NOTICE =
  "Esta alteração será aplicada somente às novas compras. Pedidos já realizados manterão os preços, custos e resultados financeiros registrados no momento da venda.";

function money(value: number | null | undefined) {
  return currencyFormatter.format(Number(value ?? 0));
}

function percent(value: number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`;
}

function moneyInput(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return Number(value).toFixed(2).replace(".", ",");
}

function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function categoryLabel(value: string) {
  return CATEGORY_LABELS[value] ?? value.replaceAll("_", " ");
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  accent?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 shadow-[0_14px_38px_rgba(15,23,42,0.04)] ${
        accent ? "border-red-200 bg-red-50/70" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-black tracking-[-0.04em] text-gray-950 xl:text-[1.7rem]">
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
            accent ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-3 text-xs leading-5 ${accent ? "text-red-700/80" : "text-gray-500"}`}>{hint}</p>
    </article>
  );
}

function FinanceSkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando financeiro">
      <div className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-white" />
        ))}
      </div>
      <div className="h-[360px] animate-pulse rounded-2xl border border-gray-200 bg-white" />
    </div>
  );
}

function PerformanceTable({ rows, mode }: { rows: FinancialPerformanceRow[]; mode: "products" | "categories" }) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <ReceiptText className="mx-auto h-7 w-7 text-gray-300" aria-hidden="true" />
        <p className="mt-3 font-bold text-gray-900">Sem vendas financeiras neste período</p>
        <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-gray-500">
          O ranking usa somente pedidos pagos e válidos que já possuem snapshot financeiro completo.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1040px] w-full text-left text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-black uppercase tracking-[0.08em] text-gray-500">
          <tr>
            <th className="px-5 py-3.5">{mode === "products" ? "Produto" : "Categoria"}</th>
            <th className="px-4 py-3.5 text-right">Unid.</th>
            <th className="px-4 py-3.5 text-right">Faturamento</th>
            <th className="px-4 py-3.5 text-right">Custos</th>
            <th className="px-4 py-3.5 text-right">Lucro</th>
            <th className="px-4 py-3.5 text-right">Margem</th>
            <th className="px-5 py-3.5 text-right">5% do lucro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={`${mode}-${row.id}`} className="align-top transition hover:bg-gray-50/70 motion-reduce:transition-none">
              <td className="px-5 py-4">
                <p className="max-w-md font-extrabold text-gray-950">
                  {mode === "categories" ? categoryLabel(row.name) : row.name}
                </p>
                {mode === "products" ? (
                  <p className="mt-1 text-xs font-medium text-gray-400">{categoryLabel(row.category)}</p>
                ) : null}
                <details className="group mt-2 max-w-xl">
                  <summary className="cursor-pointer list-none text-xs font-bold text-red-600 marker:hidden">
                    Por que deu este lucro?
                  </summary>
                  <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
                    Produtos {money(row.baseRevenue)} + adicionais {money(row.addOnRevenue)} − descontos {money(row.discounts)} − custo dos produtos {money(row.productCost)} − custo dos adicionais {money(row.addOnCost)} = <strong className="text-gray-950">{money(row.profit)}</strong>.
                  </p>
                </details>
              </td>
              <td className="px-4 py-4 text-right font-bold tabular-nums text-gray-700">{numberFormatter.format(row.units)}</td>
              <td className="px-4 py-4 text-right font-bold tabular-nums text-gray-950">{money(row.revenue)}</td>
              <td className="px-4 py-4 text-right font-semibold tabular-nums text-gray-600">{money(row.cost)}</td>
              <td className="px-4 py-4 text-right font-black tabular-nums text-gray-950">{money(row.profit)}</td>
              <td className="px-4 py-4 text-right font-bold tabular-nums text-gray-700">{percent(row.margin)}</td>
              <td className="px-5 py-4 text-right font-black tabular-nums text-red-600">{money(row.share5)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddOnSettings({
  settings,
  onSaved,
}: {
  settings: FinanceSettings;
  onSaved: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => ({
    personalizationPrice: moneyInput(settings.personalizationPrice),
    personalizationCost: moneyInput(settings.personalizationCost),
    phrasePrice: moneyInput(settings.phrasePrice),
    phraseCost: moneyInput(settings.phraseCost),
    patchPrice: moneyInput(settings.patchPrice),
    patchCost: moneyInput(settings.patchCost),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft({
      personalizationPrice: moneyInput(settings.personalizationPrice),
      personalizationCost: moneyInput(settings.personalizationCost),
      phrasePrice: moneyInput(settings.phrasePrice),
      phraseCost: moneyInput(settings.phraseCost),
      patchPrice: moneyInput(settings.patchPrice),
      patchCost: moneyInput(settings.patchCost),
    });
  }, [settings]);

  async function handleSave() {
    const values = {
      personalizationPrice: parseMoney(draft.personalizationPrice),
      personalizationCost: parseMoney(draft.personalizationCost),
      phrasePrice: parseMoney(draft.phrasePrice),
      phraseCost: parseMoney(draft.phraseCost),
      patchPrice: parseMoney(draft.patchPrice),
      patchCost: parseMoney(draft.patchCost),
    };

    if (Object.values(values).some((value) => value === null)) {
      setError("Informe valores monetários válidos com até duas casas decimais.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await saveFinanceSettings(values as Record<keyof typeof values, number>);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-finance-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-financial-dashboard"] }),
      ]);
      onSaved(`Adicionais atualizados. ${SNAPSHOT_NOTICE}`);
    } catch (saveError) {
      setError(getUserFacingError(saveError, "Não foi possível salvar os valores agora."));
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    { key: "personalization", label: "Nome + Número", price: "personalizationPrice", cost: "personalizationCost" },
    { key: "phrase", label: "Frase personalizada", price: "phrasePrice", cost: "phraseCost" },
    { key: "patch", label: "Patch", price: "patchPrice", cost: "patchCost" },
  ] as const;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
            <Settings2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-black tracking-tight text-gray-950">Adicionais</h2>
            <p className="mt-0.5 text-sm text-gray-500">Preço cobrado e custo vigente para novas compras.</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(180px,1fr)_180px_180px] sm:items-end sm:px-6">
            <div>
              <p className="font-extrabold text-gray-950">{row.label}</p>
              <p className="mt-1 text-xs text-gray-500">Lucro unitário = preço cobrado − custo.</p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-gray-500">Preço</span>
              <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100">
                <span className="mr-2 text-xs font-bold text-gray-400">R$</span>
                <input
                  value={draft[row.price]}
                  onChange={(event) => setDraft((current) => ({ ...current, [row.price]: event.target.value }))}
                  inputMode="decimal"
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-950 outline-none"
                  aria-label={`Preço de ${row.label}`}
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.08em] text-gray-500">Custo</span>
              <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100">
                <span className="mr-2 text-xs font-bold text-gray-400">R$</span>
                <input
                  value={draft[row.cost]}
                  onChange={(event) => setDraft((current) => ({ ...current, [row.cost]: event.target.value }))}
                  inputMode="decimal"
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-950 outline-none"
                  aria-label={`Custo de ${row.label}`}
                />
              </div>
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-2xl text-xs leading-5 text-gray-500">{SNAPSHOT_NOTICE}</p>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-10 flex-none items-center justify-center rounded-lg bg-gray-950 px-4 text-sm font-black text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          <Save className="mr-2 h-4 w-4" aria-hidden="true" />
          {saving ? "Salvando..." : "Salvar adicionais"}
        </button>
      </div>
      {error ? <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 sm:px-6">{error}</p> : null}
    </section>
  );
}

function ProductCosts({ onOpenProducts, onSaved }: { onOpenProducts: () => void; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const productsQuery = useQuery({
    queryKey: ["admin-finance-products", query, page],
    queryFn: () => fetchFinanceProductsPage(query, page),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!productsQuery.data) return;
    const next: Record<string, string> = {};
    for (const item of productsQuery.data.items) next[item.productId] = moneyInput(item.unitCost);
    setDrafts(next);
  }, [productsQuery.data]);

  async function saveCost(productId: string) {
    const unitCost = parseMoney(drafts[productId] ?? "");
    if (unitCost === null) {
      setError("Informe um custo válido com até duas casas decimais.");
      return;
    }

    setSavingId(productId);
    setError("");
    try {
      await saveProductFinance(productId, unitCost);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-finance-products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-financial-dashboard"] }),
      ]);
      onSaved(`Custo atualizado. ${SNAPSHOT_NOTICE}`);
    } catch (saveError) {
      setError(getUserFacingError(saveError, "Não foi possível salvar o custo agora."));
    } finally {
      setSavingId(null);
    }
  }

  const data = productsQuery.data;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-gray-950">Custos dos produtos</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            O preço de venda continua na gestão de Produtos, que já é a fonte comercial da loja. Aqui você controla o custo usado nos novos snapshots financeiros.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenProducts}
          className="inline-flex h-10 w-fit items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:border-gray-300 hover:text-red-600 motion-reduce:transition-none"
        >
          Editar preços de venda
          <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(searchInput.trim());
          setPage(1);
        }}
        className="flex gap-2 border-b border-gray-100 px-5 py-4 sm:px-6"
      >
        <div className="flex h-10 min-w-0 flex-1 items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100">
          <Search className="mr-2 h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar produto ou SKU"
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-950 outline-none placeholder:text-gray-400"
          />
        </div>
        <button type="submit" className="h-10 rounded-lg bg-gray-950 px-4 text-sm font-black text-white transition hover:bg-red-600 motion-reduce:transition-none">
          Buscar
        </button>
      </form>

      {productsQuery.isLoading ? (
        <div className="px-6 py-12 text-center text-sm font-semibold text-gray-500">Carregando produtos...</div>
      ) : productsQuery.error || !data ? (
        <div className="px-6 py-12 text-center">
          <p className="font-bold text-gray-900">Não foi possível carregar os custos.</p>
          <button type="button" onClick={() => void productsQuery.refetch()} className="mt-3 text-sm font-bold text-red-600">Tentar novamente</button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/80 text-[11px] font-black uppercase tracking-[0.08em] text-gray-500">
                <tr>
                  <th className="px-5 py-3.5 sm:px-6">Produto</th>
                  <th className="px-4 py-3.5 text-right">Preço atual</th>
                  <th className="px-4 py-3.5">Custo atual</th>
                  <th className="px-5 py-3.5 text-right sm:px-6">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => (
                  <tr key={item.productId} className="transition hover:bg-gray-50/70 motion-reduce:transition-none">
                    <td className="px-5 py-4 sm:px-6">
                      <p className="max-w-lg font-extrabold text-gray-950">{item.name}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {categoryLabel(item.financialCategory)}{item.sku ? ` • ${item.sku}` : ""}
                        {item.isManualCost ? " • custo manual" : " • custo inicial"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-black tabular-nums text-gray-950">{money(item.salePrice)}</td>
                    <td className="px-4 py-4">
                      <div className={`flex h-10 w-36 items-center rounded-lg border px-3 focus-within:ring-2 ${item.costConfigured ? "border-gray-200 focus-within:border-red-400 focus-within:ring-red-100" : "border-amber-300 bg-amber-50 focus-within:border-amber-400 focus-within:ring-amber-100"}`}>
                        <span className="mr-2 text-xs font-bold text-gray-400">R$</span>
                        <input
                          value={drafts[item.productId] ?? ""}
                          onChange={(event) => setDrafts((current) => ({ ...current, [item.productId]: event.target.value }))}
                          inputMode="decimal"
                          placeholder="0,00"
                          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-gray-950 outline-none"
                          aria-label={`Custo de ${item.name}`}
                        />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right sm:px-6">
                      <button
                        type="button"
                        onClick={() => void saveCost(item.productId)}
                        disabled={savingId === item.productId}
                        className="inline-flex h-9 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-black text-gray-700 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50 motion-reduce:transition-none"
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {savingId === item.productId ? "Salvando" : "Salvar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-gray-100 px-5 py-4 text-sm sm:px-6">
            <p className="text-gray-500">
              {numberFormatter.format(data.total)} produto{data.total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 disabled:opacity-35"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-20 text-center text-xs font-bold text-gray-600">
                {data.totalPages === 0 ? 0 : page} / {data.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}
                disabled={data.totalPages === 0 || page >= data.totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 disabled:opacity-35"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
      {error ? <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 sm:px-6">{error}</p> : null}
    </section>
  );
}

export function FinancialAdmin({ onOpenProducts }: { onOpenProducts: () => void }) {
  const [period, setPeriod] = useState<FinancialPeriod>("30d");
  const [performanceMode, setPerformanceMode] = useState<"products" | "categories">("products");
  const [notice, setNotice] = useState("");

  const dashboardQuery = useQuery({
    queryKey: ["admin-financial-dashboard", period],
    queryFn: () => fetchFinancialDashboard(period),
    staleTime: 15_000,
  });

  const settingsQuery = useQuery({
    queryKey: ["admin-finance-settings"],
    queryFn: fetchFinanceSettings,
    staleTime: 30_000,
  });

  const chartData = useMemo(
    () =>
      (dashboardQuery.data?.trend ?? []).map((point) => ({
        ...point,
        label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
          new Date(`${point.date}T12:00:00`),
        ),
      })),
    [dashboardQuery.data?.trend],
  );

  if (dashboardQuery.isLoading) return <FinanceSkeleton />;

  if (dashboardQuery.error || !dashboardQuery.data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white px-6 py-12 text-center">
        <RefreshCw className="mx-auto h-7 w-7 text-red-500" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-black text-gray-950">Não foi possível carregar o Financeiro</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">Tente novamente em instantes. Nenhum dado da loja foi alterado.</p>
        <button type="button" onClick={() => void dashboardQuery.refetch()} className="mt-5 h-10 rounded-lg bg-red-600 px-4 text-sm font-black text-white">
          Tentar novamente
        </button>
      </div>
    );
  }

  const data = dashboardQuery.data;
  const rows = performanceMode === "products" ? data.products : data.categories;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 border-b border-gray-200 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-red-600">Administração financeira</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-gray-950">Financeiro</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Faturamento, custos e lucro baseados nos valores preservados no momento de cada venda.
          </p>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`h-9 flex-none rounded-full border px-3.5 text-xs font-black transition motion-reduce:transition-none ${
                period === item.id
                  ? "border-gray-950 bg-gray-950 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-950"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {notice ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800">
          {notice}
        </div>
      ) : null}

      {data.excludedOrders > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <strong>{data.excludedOrders} pedido{data.excludedOrders === 1 ? "" : "s"}</strong> pago{data.excludedOrders === 1 ? "" : "s"} no período não entra{data.excludedOrders === 1 ? "" : "m"} no lucro/custo porque foi{data.excludedOrders === 1 ? "" : "ram"} criado{data.excludedOrders === 1 ? "" : "s"} sem snapshot financeiro completo. Nenhum custo histórico foi inventado retroativamente.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Faturamento" value={money(data.summary.revenue)} hint="Produtos após descontos; frete não entra no lucro." icon={Banknote} />
        <MetricCard label="Lucro" value={money(data.summary.profit)} hint="Faturamento menos custos registrados nas vendas." icon={TrendingUp} />
        <MetricCard label="Margem" value={percent(data.summary.margin)} hint="Lucro ÷ faturamento × 100." icon={Percent} />
        <MetricCard label="Custos" value={money(data.summary.cost)} hint="Produtos e adicionais dos pedidos considerados." icon={WalletCards} />
        <MetricCard label="Pedidos" value={numberFormatter.format(data.summary.orders)} hint={`${numberFormatter.format(data.summary.units)} unidade${data.summary.units === 1 ? "" : "s"} vendida${data.summary.units === 1 ? "" : "s"}.`} icon={ShoppingBag} />
        <MetricCard label="Participação sobre o lucro" value={money(data.summary.share5)} hint="5% do lucro do período — nunca do faturamento." icon={CircleDollarSign} accent />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-gray-500">Evolução</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-gray-950">Faturamento x lucro</h2>
          </div>
          <p className="text-xs text-gray-400">Custos também aparecem para contexto.</p>
        </div>
        <div className="mt-6 h-[310px] w-full">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-gray-50 text-sm font-semibold text-gray-400">Sem movimentação financeira no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="financeRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="financeProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={70} tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`} />
                <Tooltip formatter={(value, name) => [money(Number(value)), name === "revenue" ? "Faturamento" : name === "profit" ? "Lucro" : "Custos"]} labelFormatter={(label) => `Data: ${label}`} />
                <Legend formatter={(value) => (value === "revenue" ? "Faturamento" : value === "profit" ? "Lucro" : "Custos")} />
                <Area type="monotone" dataKey="revenue" stroke="#111827" fill="url(#financeRevenue)" strokeWidth={2.2} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="profit" stroke="#dc2626" fill="url(#financeProfit)" strokeWidth={2.2} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="cost" stroke="#9ca3af" fill="transparent" strokeWidth={1.5} strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_38px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-gray-500">Desempenho</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-gray-950">Onde a loja gera resultado</h2>
          </div>
          <div className="inline-flex w-fit rounded-lg bg-gray-100 p-1">
            <button type="button" onClick={() => setPerformanceMode("products")} className={`h-8 rounded-md px-3 text-xs font-black ${performanceMode === "products" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"}`}>Produtos</button>
            <button type="button" onClick={() => setPerformanceMode("categories")} className={`h-8 rounded-md px-3 text-xs font-black ${performanceMode === "categories" ? "bg-white text-gray-950 shadow-sm" : "text-gray-500"}`}>Categorias</button>
          </div>
        </div>
        <PerformanceTable rows={rows} mode={performanceMode} />
      </section>

      <section className="pt-2">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-950 text-white"><Boxes className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-gray-500">Configuração</p>
            <h2 className="text-lg font-black tracking-tight text-gray-950">Preços e custos vigentes</h2>
          </div>
        </div>
        <div className="space-y-5">
          {settingsQuery.data ? (
            <AddOnSettings settings={settingsQuery.data} onSaved={setNotice} />
          ) : settingsQuery.isLoading ? (
            <div className="h-60 animate-pulse rounded-2xl border border-gray-200 bg-white" />
          ) : (
            <div className="rounded-2xl border border-red-200 bg-white p-6 text-sm font-semibold text-red-700">Não foi possível carregar os valores dos adicionais.</div>
          )}
          <ProductCosts onOpenProducts={onOpenProducts} onSaved={setNotice} />
        </div>
      </section>
    </div>
  );
}
