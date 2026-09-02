import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  archiveAdminProduct,
  fetchAdminCatalog,
  saveAdminProduct,
  type AdminCategory,
  type AdminProduct,
  type AdminProductInput,
  type AdminProductStatus,
} from "@/lib/admin-products";

type ProductFormState = {
  id: string;
  defaultVariantId: string;
  assignedSku: string;
  assignedSlug: string;
  assignedVariantSku: string;
  name: string;
  description: string;
  price: string;
  promotionalPrice: string;
  status: AdminProductStatus;
  primaryCategoryId: string;
  campeonato: string;
  liga: string;
  time: string;
  specifications: string;
  weightGrams: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  variantName: string;
  stockQuantity: string;
};

const EMPTY_FORM: ProductFormState = {
  id: "",
  defaultVariantId: "",
  assignedSku: "",
  assignedSlug: "",
  assignedVariantSku: "",
  name: "",
  description: "",
  price: "",
  promotionalPrice: "",
  status: "draft",
  primaryCategoryId: "",
  campeonato: "",
  liga: "",
  time: "",
  specifications: "",
  weightGrams: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  variantName: "",
  stockQuantity: "0",
};

function productToForm(product: AdminProduct): ProductFormState {
  return {
    id: product.id,
    defaultVariantId: product.defaultVariant?.id ?? "",
    assignedSku: product.sku,
    assignedSlug: product.slug,
    assignedVariantSku: product.defaultVariant?.sku ?? `${product.sku}-STD`,
    name: product.name,
    description: product.description ?? "",
    price: String(product.price),
    promotionalPrice:
      product.promotional_price === null ? "" : String(product.promotional_price),
    status: product.status,
    primaryCategoryId: product.primary_category_id ?? "",
    campeonato: product.campeonato ?? "",
    liga: product.liga ?? "",
    time: product.time ?? "",
    specifications: product.specifications ?? "",
    weightGrams: product.weight_grams === null ? "" : String(product.weight_grams),
    lengthCm: product.length_cm === null ? "" : String(product.length_cm),
    widthCm: product.width_cm === null ? "" : String(product.width_cm),
    heightCm: product.height_cm === null ? "" : String(product.height_cm),
    variantName: product.defaultVariant?.name ?? "",
    stockQuantity: String(product.defaultVariant?.stock_quantity ?? 0),
  };
}

function parseRequiredNumber(value: string, label: string): number {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error(`Informe ${label} válido.`);
  return parsed;
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error("Há um campo numérico inválido.");
  return parsed;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function statusLabel(status: AdminProductStatus) {
  switch (status) {
    case "active":
      return "Ativo";
    case "inactive":
      return "Inativo";
    case "archived":
      return "Arquivado";
    default:
      return "Rascunho";
  }
}

function statusClassName(status: AdminProductStatus) {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "inactive":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "archived":
      return "border-gray-200 bg-gray-100 text-gray-500";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function fieldClassName() {
  return "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20";
}

function textareaClassName() {
  return "mt-1 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20";
}

export function ProductAdmin() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const snapshot = await fetchAdminCatalog();
      setProducts(snapshot.products);
      setCategories(snapshot.categories);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a administração de produtos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return products;

    return products.filter((product) =>
      [
        product.name,
        product.sku,
        product.slug,
        product.category ?? "",
        product.time ?? "",
        product.liga ?? "",
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(query)),
    );
  }, [products, search]);

  function updateField<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startNewProduct() {
    setForm(EMPTY_FORM);
    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function startEditing(product: AdminProduct) {
    setForm(productToForm(product));
    setErrorMessage("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function cancelEditing() {
    setForm(EMPTY_FORM);
    setShowForm(false);
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const selectedCategory = categories.find(
        (category) => category.id === form.primaryCategoryId,
      );

      const input: AdminProductInput = {
        id: form.id || undefined,
        defaultVariantId: form.defaultVariantId || undefined,
        name: form.name,
        description: form.description,
        price: parseRequiredNumber(form.price, "um preço"),
        promotionalPrice: parseOptionalNumber(form.promotionalPrice),
        status: form.status,
        primaryCategoryId: form.primaryCategoryId || null,
        categoryName: selectedCategory?.name ?? null,
        campeonato: form.campeonato,
        liga: form.liga,
        time: form.time,
        specifications: form.specifications,
        weightGrams: parseOptionalNumber(form.weightGrams),
        lengthCm: parseOptionalNumber(form.lengthCm),
        widthCm: parseOptionalNumber(form.widthCm),
        heightCm: parseOptionalNumber(form.heightCm),
        variantName: form.variantName,
        stockQuantity: parseRequiredNumber(form.stockQuantity, "um estoque"),
      };

      await saveAdminProduct(input);
      await loadCatalog();

      setSuccessMessage(
        form.id
          ? "Produto atualizado com sucesso."
          : "Produto criado com identificadores automáticos.",
      );
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível salvar o produto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmArchive() {
    const product = archiveTarget;
    if (!product || archiving || product.status === "archived") return;

    setArchiving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await archiveAdminProduct(product.id);
      await loadCatalog();
      setArchiveTarget(null);
      setSuccessMessage("Produto arquivado com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível arquivar o produto.",
      );
    } finally {
      setArchiving(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Fase 07</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Produtos
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Cadastre e mantenha o catálogo. SKU, slug e SKU da variante são
            atribuídos automaticamente; o estoque do produto é calculado pelas variantes.
          </p>
        </div>

        <button
          type="button"
          onClick={startNewProduct}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Novo produto
        </button>
      </div>

      {errorMessage && !showForm ? (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {successMessage}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/20 p-5 sm:p-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {form.id ? "Editar produto" : "Novo produto"}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {form.id
                  ? "Os identificadores internos permanecem fixos para preservar integrações e URLs."
                  : "Ao salvar, o banco consome automaticamente uma reserva livre de SKU e slug e cria a variante padrão."}
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEditing}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
          </div>

          <div className="p-5 sm:p-6">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Identificadores automáticos
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Você não precisa preencher SKU ou slug.
                  </p>
                </div>
                {!form.id ? (
                  <span className="mt-2 inline-flex w-fit rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground sm:mt-0">
                    Reserva atribuída ao criar
                  </span>
                ) : null}
              </div>

              {form.id ? (
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">SKU do produto</dt>
                    <dd className="mt-1 font-mono font-medium text-foreground">{form.assignedSku}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Slug</dt>
                    <dd className="mt-1 font-mono font-medium text-foreground">/{form.assignedSlug}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">SKU da variante</dt>
                    <dd className="mt-1 font-mono font-medium text-foreground">{form.assignedVariantSku}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  O sistema mantém 20 reservas livres para produtos futuros e repõe automaticamente uma nova reserva sempre que uma é usada.
                </p>
              )}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-medium text-foreground md:col-span-2">
                Nome
                <input
                  required
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Ex.: Camisa Brasil Torcedor 2026"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Preço
                <input
                  required
                  inputMode="decimal"
                  value={form.price}
                  onChange={(event) => updateField("price", event.target.value)}
                  className={fieldClassName()}
                  placeholder="199,90"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Preço promocional
                <input
                  inputMode="decimal"
                  value={form.promotionalPrice}
                  onChange={(event) => updateField("promotionalPrice", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Opcional"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Status
                <select
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value as AdminProductStatus)}
                  className={fieldClassName()}
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="archived">Arquivado</option>
                </select>
              </label>

              <label className="text-sm font-medium text-foreground">
                Categoria principal
                <select
                  value={form.primaryCategoryId}
                  onChange={(event) => updateField("primaryCategoryId", event.target.value)}
                  className={fieldClassName()}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}{category.is_active ? "" : " (inativa)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-foreground">
                Campeonato
                <input
                  value={form.campeonato}
                  onChange={(event) => updateField("campeonato", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Ex.: Brasileirão"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Liga
                <input
                  value={form.liga}
                  onChange={(event) => updateField("liga", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Ex.: Premier League"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Time / seleção
                <input
                  value={form.time}
                  onChange={(event) => updateField("time", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Ex.: Brasil"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Nome da variante padrão
                <input
                  value={form.variantName}
                  onChange={(event) => updateField("variantName", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Ex.: Padrão"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Estoque
                <input
                  required
                  inputMode="numeric"
                  value={form.stockQuantity}
                  onChange={(event) => updateField("stockQuantity", event.target.value)}
                  className={fieldClassName()}
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Peso (g)
                <input
                  inputMode="decimal"
                  value={form.weightGrams}
                  onChange={(event) => updateField("weightGrams", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Opcional nesta etapa"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Comprimento (cm)
                <input
                  inputMode="decimal"
                  value={form.lengthCm}
                  onChange={(event) => updateField("lengthCm", event.target.value)}
                  className={fieldClassName()}
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Largura (cm)
                <input
                  inputMode="decimal"
                  value={form.widthCm}
                  onChange={(event) => updateField("widthCm", event.target.value)}
                  className={fieldClassName()}
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Altura (cm)
                <input
                  inputMode="decimal"
                  value={form.heightCm}
                  onChange={(event) => updateField("heightCm", event.target.value)}
                  className={fieldClassName()}
                />
              </label>

              <label className="text-sm font-medium text-foreground md:col-span-2">
                Descrição
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className={textareaClassName()}
                />
              </label>

              <label className="text-sm font-medium text-foreground md:col-span-2">
                Especificações
                <textarea
                  value={form.specifications}
                  onChange={(event) => updateField("specifications", event.target.value)}
                  className={textareaClassName()}
                />
              </label>
            </div>

            <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              Imagens reais/R2 não são carregadas nesta etapa. A infraestrutura de imagens permanece preparada para a carga definitiva posterior.
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar produto"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cancelEditing}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="mt-7 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Catálogo administrativo</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {products.length} produto{products.length === 1 ? "" : "s"} no banco
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nome, SKU, time ou liga..."
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando catálogo...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-foreground">
              {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum resultado encontrado"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length === 0
                ? "O catálogo está limpo e pronto para os produtos reais quando chegar a fase de carga."
                : "Tente outro termo de busca."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredProducts.map((product) => {
              const currentPrice = product.promotional_price ?? product.price;
              return (
                <article
                  key={product.id}
                  className="grid gap-4 p-5 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.6fr)_minmax(180px,.7fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate font-semibold text-foreground">{product.name}</h4>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClassName(product.status)}`}>
                        {statusLabel(product.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{product.sku}</span>
                      <span className="font-mono">/{product.slug}</span>
                      <span>{product.category ?? "Sem categoria"}</span>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="font-semibold text-foreground">{formatMoney(currentPrice)}</p>
                    {product.promotional_price !== null ? (
                      <p className="text-xs text-muted-foreground line-through">{formatMoney(product.price)}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Estoque: {product.defaultVariant?.stock_quantity ?? 0}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => startEditing(product)}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={product.status === "archived"}
                      onClick={() => setArchiveTarget(product)}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Arquivar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
        title="Arquivar produto?"
        description={
          archiveTarget
            ? `“${archiveTarget.name}” deixará de aparecer no catálogo público, mas continuará preservado no banco e no histórico administrativo.`
            : "O produto deixará de aparecer no catálogo público."
        }
        confirmLabel="Arquivar produto"
        cancelLabel="Manter produto"
        tone="warning"
        loading={archiving}
        onConfirm={confirmArchive}
      />
    </section>
  );
}
