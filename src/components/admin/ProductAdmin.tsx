import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

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
  name: string;
  sku: string;
  slug: string;
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
  variantSku: string;
  variantName: string;
  stockQuantity: string;
};

const EMPTY_FORM: ProductFormState = {
  id: "",
  defaultVariantId: "",
  name: "",
  sku: "",
  slug: "",
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
  variantSku: "",
  variantName: "",
  stockQuantity: "0",
};

function productToForm(product: AdminProduct): ProductFormState {
  return {
    id: product.id,
    defaultVariantId: product.defaultVariant?.id ?? "",
    name: product.name,
    sku: product.sku,
    slug: product.slug,
    description: product.description ?? "",
    price: String(product.price),
    promotionalPrice:
      product.promotional_price === null
        ? ""
        : String(product.promotional_price),
    status: product.status,
    primaryCategoryId: product.primary_category_id ?? "",
    campeonato: product.campeonato ?? "",
    liga: product.liga ?? "",
    time: product.time ?? "",
    specifications: product.specifications ?? "",
    weightGrams:
      product.weight_grams === null ? "" : String(product.weight_grams),
    lengthCm: product.length_cm === null ? "" : String(product.length_cm),
    widthCm: product.width_cm === null ? "" : String(product.width_cm),
    heightCm: product.height_cm === null ? "" : String(product.height_cm),
    variantSku: product.defaultVariant?.sku ?? `${product.sku}-PADRAO`,
    variantName: product.defaultVariant?.name ?? "",
    stockQuantity: String(product.defaultVariant?.stock_quantity ?? 0),
  };
}

function parseRequiredNumber(value: string, label: string): number {
  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed)) {
    throw new Error(`Informe ${label} válido.`);
  }

  return parsed;
}

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(",", "."));

  if (!Number.isFinite(parsed)) {
    throw new Error("Há um campo numérico inválido.");
  }

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

    if (!query) {
      return products;
    }

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
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
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

    if (saving) {
      return;
    }

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
        sku: form.sku,
        slug: form.slug,
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
        variantSku: form.variantSku,
        variantName: form.variantName,
        stockQuantity: parseRequiredNumber(form.stockQuantity, "um estoque"),
      };

      await saveAdminProduct(input);
      await loadCatalog();

      setSuccessMessage(
        form.id ? "Produto atualizado com sucesso." : "Produto criado com sucesso.",
      );
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o produto.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(product: AdminProduct) {
    if (product.status === "archived") {
      return;
    }

    const confirmed = window.confirm(
      `Arquivar “${product.name}”? Ele deixará de aparecer no catálogo público.`,
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await archiveAdminProduct(product.id);
      await loadCatalog();
      setSuccessMessage("Produto arquivado com sucesso.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível arquivar o produto.",
      );
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
            Cadastre e mantenha o catálogo. O estoque exibido em produtos é
            calculado pelas variantes; não é alterado diretamente.
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

      {errorMessage ? (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-5 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          {successMessage}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {form.id ? "Editar produto" : "Novo produto"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Produtos novos são criados com uma variante padrão para manter
                preço, estoque e ativação consistentes.
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
              SKU do produto
              <input
                required
                value={form.sku}
                onChange={(event) => updateField("sku", event.target.value)}
                className={fieldClassName()}
                placeholder="BIG-BRA-001"
              />
            </label>

            <label className="text-sm font-medium text-foreground">
              Slug
              <input
                value={form.slug}
                onChange={(event) => updateField("slug", event.target.value)}
                className={fieldClassName()}
                placeholder="Deixe vazio para gerar pelo nome"
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
                onChange={(event) =>
                  updateField("promotionalPrice", event.target.value)
                }
                className={fieldClassName()}
                placeholder="Opcional"
              />
            </label>

            <label className="text-sm font-medium text-foreground">
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  updateField(
                    "status",
                    event.target.value as AdminProductStatus,
                  )
                }
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
                onChange={(event) =>
                  updateField("primaryCategoryId", event.target.value)
                }
                className={fieldClassName()}
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.is_active ? "" : " (inativa)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-foreground">
              Campeonato
              <input
                value={form.campeonato}
                onChange={(event) =>
                  updateField("campeonato", event.target.value)
                }
                className={fieldClassName()}
              />
            </label>

            <label className="text-sm font-medium text-foreground">
              Liga
              <input
                value={form.liga}
                onChange={(event) => updateField("liga", event.target.value)}
                className={fieldClassName()}
              />
            </label>

            <label className="text-sm font-medium text-foreground md:col-span-2">
              Time / seleção
              <input
                value={form.time}
                onChange={(event) => updateField("time", event.target.value)}
                className={fieldClassName()}
              />
            </label>

            <label className="text-sm font-medium text-foreground md:col-span-2">
              Descrição
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                className={textareaClassName()}
              />
            </label>

            <label className="text-sm font-medium text-foreground md:col-span-2">
              Especificações
              <textarea
                value={form.specifications}
                onChange={(event) =>
                  updateField("specifications", event.target.value)
                }
                className={textareaClassName()}
                placeholder="Material, composição, origem e demais detalhes"
              />
            </label>
          </div>

          <div className="mt-7 border-t border-border pt-6">
            <h4 className="font-semibold text-foreground">Variante padrão e estoque</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              A Fase 07 administra a variante padrão. Combinações avançadas de
              opções continuam compatíveis com a modelagem existente.
            </p>

            <div className="mt-4 grid gap-5 md:grid-cols-3">
              <label className="text-sm font-medium text-foreground">
                SKU da variante
                <input
                  required
                  value={form.variantSku}
                  onChange={(event) =>
                    updateField("variantSku", event.target.value)
                  }
                  className={fieldClassName()}
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Nome da variante
                <input
                  value={form.variantName}
                  onChange={(event) =>
                    updateField("variantName", event.target.value)
                  }
                  className={fieldClassName()}
                  placeholder="Opcional"
                />
              </label>

              <label className="text-sm font-medium text-foreground">
                Estoque
                <input
                  required
                  inputMode="numeric"
                  value={form.stockQuantity}
                  onChange={(event) =>
                    updateField("stockQuantity", event.target.value)
                  }
                  className={fieldClassName()}
                />
              </label>
            </div>
          </div>

          <div className="mt-7 border-t border-border pt-6">
            <h4 className="font-semibold text-foreground">Peso e dimensões</h4>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-foreground">
                Peso (g)
                <input
                  inputMode="numeric"
                  value={form.weightGrams}
                  onChange={(event) =>
                    updateField("weightGrams", event.target.value)
                  }
                  className={fieldClassName()}
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
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar produto"}
            </button>

            <button
              type="button"
              onClick={cancelEditing}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancelar
            </button>

            <p className="text-xs text-muted-foreground">
              Imagens reais/R2 não são carregadas nesta etapa.
            </p>
          </div>
        </form>
      ) : null}

      <div className="mt-6 rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">Catálogo administrativo</p>
            <p className="text-sm text-muted-foreground">
              {products.length} produto{products.length === 1 ? "" : "s"} no banco
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 sm:max-w-sm"
            placeholder="Buscar por nome, SKU, time ou liga"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Carregando produtos...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-medium text-foreground">
              {products.length === 0
                ? "Nenhum produto cadastrado."
                : "Nenhum produto encontrado."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length === 0
                ? "Use “Novo produto” para criar o primeiro registro real quando estiver pronto."
                : "Tente outro termo de busca."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Preço</th>
                  <th className="px-4 py-3 font-medium">Estoque</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.sku} · /{product.slug}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                        {statusLabel(product.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-foreground">
                      {product.promotional_price !== null ? (
                        <>
                          <p className="font-medium">
                            {formatMoney(product.promotional_price)}
                          </p>
                          <p className="text-xs text-muted-foreground line-through">
                            {formatMoney(product.price)}
                          </p>
                        </>
                      ) : (
                        formatMoney(product.price)
                      )}
                    </td>
                    <td className="px-4 py-4 text-foreground">{product.stock}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {product.category ?? "—"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(product)}
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={product.status === "archived"}
                          onClick={() => void handleArchive(product)}
                          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Arquivar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
