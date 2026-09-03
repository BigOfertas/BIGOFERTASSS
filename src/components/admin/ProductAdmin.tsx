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
import {
  PRODUCT_CONTEXT_OPTIONS,
  PRODUCT_SEASON_OPTIONS,
  extractSeasonFromSpecifications,
  getCompetitionOption,
  getCompetitionOptionsForContext,
  inferProductContext,
  mergeSeasonIntoSpecifications,
  type CompetitionStorageField,
  type ProductContextType,
} from "@/lib/product-taxonomy";

type ProductFormState = {
  id: string;
  defaultVariantId: string;
  name: string;
  description: string;
  price: string;
  promotionalPrice: string;
  status: AdminProductStatus;
  primaryCategoryId: string;
  contextType: ProductContextType | "";
  competition: string;
  competitionField: CompetitionStorageField | "";
  time: string;
  season: string;
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
  name: "",
  description: "",
  price: "",
  promotionalPrice: "",
  status: "draft",
  primaryCategoryId: "",
  contextType: "",
  competition: "",
  competitionField: "",
  time: "",
  season: "",
  specifications: "",
  weightGrams: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
  variantName: "Padrão",
  stockQuantity: "0",
};

function productToForm(product: AdminProduct): ProductFormState {
  const storedCompetition = product.liga?.trim() || product.campeonato?.trim() || "";
  const knownCompetition = getCompetitionOption(storedCompetition);
  const parsedSpecifications = extractSeasonFromSpecifications(product.specifications);

  return {
    id: product.id,
    defaultVariantId: product.defaultVariant?.id ?? "",
    name: product.name,
    description: product.description ?? "",
    price: String(product.price),
    promotionalPrice:
      product.promotional_price === null ? "" : String(product.promotional_price),
    status: product.status,
    primaryCategoryId: product.primary_category_id ?? "",
    contextType: inferProductContext(product.campeonato, product.liga),
    competition: storedCompetition,
    competitionField:
      knownCompetition?.storageField ??
      (product.liga?.trim() ? "liga" : product.campeonato?.trim() ? "campeonato" : ""),
    time: product.time ?? "",
    season: parsedSpecifications.season,
    specifications: parsedSpecifications.specifications,
    weightGrams: product.weight_grams === null ? "" : String(product.weight_grams),
    lengthCm: product.length_cm === null ? "" : String(product.length_cm),
    widthCm: product.width_cm === null ? "" : String(product.width_cm),
    heightCm: product.height_cm === null ? "" : String(product.height_cm),
    variantName: product.defaultVariant?.name ?? "Padrão",
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
  return "mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10";
}

function textareaClassName() {
  return "mt-1 min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10";
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="md:col-span-2">
      <h4 className="font-bold text-gray-950">{title}</h4>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );
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
          : "Não foi possível carregar os produtos.",
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
        product.category ?? "",
        product.time ?? "",
        product.liga ?? "",
        product.campeonato ?? "",
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(query)),
    );
  }, [products, search]);

  const availableCompetitions = useMemo(
    () =>
      form.contextType
        ? getCompetitionOptionsForContext(form.contextType)
        : [],
    [form.contextType],
  );

  const selectedCompetition = getCompetitionOption(form.competition);
  const availableTeams = selectedCompetition?.teams ?? [];
  const legacyCompetition = Boolean(
    form.competition && !getCompetitionOption(form.competition),
  );
  const legacyTeam = Boolean(
    form.time && !availableTeams.some((team) => team === form.time),
  );
  const legacySeason = Boolean(
    form.season && !PRODUCT_SEASON_OPTIONS.some((season) => season === form.season),
  );

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

  function handleContextChange(value: ProductContextType | "") {
    setForm((current) => ({
      ...current,
      contextType: value,
      competition: "",
      competitionField: "",
      time: "",
    }));
  }

  function handleCompetitionChange(value: string) {
    const option = getCompetitionOption(value);
    setForm((current) => ({
      ...current,
      competition: value,
      competitionField: option?.storageField ?? current.competitionField,
      time: "",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!form.contextType) {
        throw new Error("Selecione se o produto é de clube, seleção ou sem vínculo esportivo.");
      }

      let campeonato = "";
      let liga = "";
      let time = "";

      if (form.contextType !== "other") {
        if (!form.competition) {
          throw new Error("Selecione a competição do produto.");
        }
        if (!form.time) {
          throw new Error("Selecione o time ou a seleção do produto.");
        }

        const competition = getCompetitionOption(form.competition);
        const storageField = competition?.storageField || form.competitionField;

        if (!storageField) {
          throw new Error("Selecione novamente a competição do produto.");
        }

        if (storageField === "liga") liga = form.competition;
        else campeonato = form.competition;
        time = form.time;
      }

      const selectedCategory = categories.find(
        (category) => category.id === form.primaryCategoryId,
      );

      const input: AdminProductInput = {
        ...(form.id ? { id: form.id } : {}),
        ...(form.defaultVariantId
          ? { defaultVariantId: form.defaultVariantId }
          : {}),
        name: form.name,
        description: form.description,
        price: parseRequiredNumber(form.price, "um preço"),
        promotionalPrice: parseOptionalNumber(form.promotionalPrice),
        status: form.status,
        primaryCategoryId: form.primaryCategoryId || null,
        categoryName: selectedCategory?.name ?? null,
        campeonato,
        liga,
        time,
        specifications: mergeSeasonIntoSpecifications(
          form.specifications,
          form.season,
        ),
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
        form.id ? "Produto atualizado com sucesso." : "Produto criado com sucesso.",
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
          <h2 className="text-2xl font-black tracking-tight text-gray-950">Produtos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Cadastre os produtos da loja e classifique cada item pelas opções disponíveis.
          </p>
        </div>

        <button
          type="button"
          onClick={startNewProduct}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700"
        >
          Novo produto
        </button>
      </div>

      {errorMessage && !showForm ? (
        <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-5 sm:px-6">
            <div>
              <h3 className="text-lg font-bold text-gray-950">
                {form.id ? "Editar produto" : "Novo produto"}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Preencha as informações comerciais e escolha a classificação correta.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEditing}
              className="text-sm font-semibold text-gray-500 hover:text-gray-900"
            >
              Fechar
            </button>
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <SectionTitle
                title="Informações do produto"
                description="Nome, descrição e categoria que o cliente verá na loja."
              />

              <label className="text-sm font-semibold text-gray-800 md:col-span-2">
                Nome
                <input
                  required
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Ex.: Camisa Real Madrid I 2026/27"
                />
              </label>

              <label className="text-sm font-semibold text-gray-800 md:col-span-2">
                Descrição
                <textarea
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className={textareaClassName()}
                  placeholder="Descreva o produto de forma objetiva."
                />
              </label>

              <label className="text-sm font-semibold text-gray-800 md:col-span-2">
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

              <div className="md:col-span-2 my-1 border-t border-gray-100" />
              <SectionTitle
                title="Classificação esportiva"
                description="Use apenas as opções prontas. Isso evita produtos duplicados em filtros por erro de digitação."
              />

              <label className="text-sm font-semibold text-gray-800">
                Tipo
                <select
                  required
                  value={form.contextType}
                  onChange={(event) =>
                    handleContextChange(event.target.value as ProductContextType | "")
                  }
                  className={fieldClassName()}
                >
                  <option value="">Selecione</option>
                  {PRODUCT_CONTEXT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Competição
                <select
                  required={Boolean(form.contextType && form.contextType !== "other")}
                  disabled={!form.contextType || form.contextType === "other"}
                  value={form.contextType === "other" ? "" : form.competition}
                  onChange={(event) => handleCompetitionChange(event.target.value)}
                  className={`${fieldClassName()} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400`}
                >
                  <option value="">
                    {form.contextType === "other" ? "Não se aplica" : "Selecione"}
                  </option>
                  {legacyCompetition ? (
                    <option value={form.competition}>{form.competition} (cadastro antigo)</option>
                  ) : null}
                  {availableCompetitions.map((option) => (
                    <option key={option.label} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Time / seleção
                <select
                  required={Boolean(form.contextType && form.contextType !== "other")}
                  disabled={
                    !form.contextType ||
                    form.contextType === "other" ||
                    !form.competition
                  }
                  value={form.contextType === "other" ? "" : form.time}
                  onChange={(event) => updateField("time", event.target.value)}
                  className={`${fieldClassName()} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400`}
                >
                  <option value="">
                    {form.contextType === "other" ? "Não se aplica" : "Selecione"}
                  </option>
                  {legacyTeam ? (
                    <option value={form.time}>{form.time} (cadastro antigo)</option>
                  ) : null}
                  {availableTeams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Temporada
                <select
                  value={form.season}
                  onChange={(event) => updateField("season", event.target.value)}
                  className={fieldClassName()}
                >
                  <option value="">Sem temporada</option>
                  {legacySeason ? (
                    <option value={form.season}>{form.season} (cadastro antigo)</option>
                  ) : null}
                  {PRODUCT_SEASON_OPTIONS.map((season) => (
                    <option key={season} value={season}>
                      {season}
                    </option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2 my-1 border-t border-gray-100" />
              <SectionTitle
                title="Preço e publicação"
                description="Defina quanto custa e se o produto já pode aparecer na loja."
              />

              <label className="text-sm font-semibold text-gray-800">
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

              <label className="text-sm font-semibold text-gray-800">
                Preço promocional
                <input
                  inputMode="decimal"
                  value={form.promotionalPrice}
                  onChange={(event) => updateField("promotionalPrice", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Opcional"
                />
              </label>

              <label className="text-sm font-semibold text-gray-800 md:col-span-2">
                Situação
                <select
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value as AdminProductStatus)}
                  className={fieldClassName()}
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativo na loja</option>
                  <option value="inactive">Inativo</option>
                  <option value="archived">Arquivado</option>
                </select>
              </label>

              <div className="md:col-span-2 my-1 border-t border-gray-100" />
              <SectionTitle
                title="Variação e envio"
                description="Informações usadas na preparação e no cálculo do frete."
              />

              <label className="text-sm font-semibold text-gray-800">
                Variação
                <input
                  value={form.variantName}
                  onChange={(event) => updateField("variantName", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Ex.: Padrão"
                />
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Quantidade disponível
                <input
                  required
                  inputMode="numeric"
                  value={form.stockQuantity}
                  onChange={(event) => updateField("stockQuantity", event.target.value)}
                  className={fieldClassName()}
                />
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Peso (g)
                <input
                  inputMode="decimal"
                  value={form.weightGrams}
                  onChange={(event) => updateField("weightGrams", event.target.value)}
                  className={fieldClassName()}
                  placeholder="Ex.: 300"
                />
              </label>

              <div className="hidden md:block" />

              <label className="text-sm font-semibold text-gray-800">
                Comprimento (cm)
                <input
                  inputMode="decimal"
                  value={form.lengthCm}
                  onChange={(event) => updateField("lengthCm", event.target.value)}
                  className={fieldClassName()}
                />
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Largura (cm)
                <input
                  inputMode="decimal"
                  value={form.widthCm}
                  onChange={(event) => updateField("widthCm", event.target.value)}
                  className={fieldClassName()}
                />
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Altura (cm)
                <input
                  inputMode="decimal"
                  value={form.heightCm}
                  onChange={(event) => updateField("heightCm", event.target.value)}
                  className={fieldClassName()}
                />
              </label>

              <div className="hidden md:block" />

              <label className="text-sm font-semibold text-gray-800 md:col-span-2">
                Especificações
                <textarea
                  value={form.specifications}
                  onChange={(event) => updateField("specifications", event.target.value)}
                  className={textareaClassName()}
                  placeholder="Ex.: tecido, modelagem, detalhes da peça..."
                />
              </label>
            </div>

            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              As fotos do produto serão adicionadas na etapa de imagens do catálogo.
            </div>

            {errorMessage ? (
              <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-200 pt-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar produto"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={cancelEditing}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="mt-7 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-gray-950">Catálogo</h3>
            <p className="mt-1 text-xs text-gray-500">
              {products.length} produto{products.length === 1 ? "" : "s"} cadastrado{products.length === 1 ? "" : "s"}
            </p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, categoria, time ou competição..."
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Carregando catálogo...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-gray-950">
              {products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum resultado encontrado"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {products.length === 0
                ? "Cadastre o primeiro produto quando estiver pronto."
                : "Tente outro termo de busca."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredProducts.map((product) => {
              const currentPrice = product.promotional_price ?? product.price;
              const competition = product.liga ?? product.campeonato;
              return (
                <article
                  key={product.id}
                  className="grid gap-4 p-5 transition-colors hover:bg-gray-50 lg:grid-cols-[minmax(0,1.6fr)_minmax(180px,.7fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate font-bold text-gray-950">{product.name}</h4>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClassName(product.status)}`}>
                        {statusLabel(product.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>{product.category ?? "Sem categoria"}</span>
                      {competition ? <span>{competition}</span> : null}
                      {product.time ? <span>{product.time}</span> : null}
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="font-bold text-gray-950">{formatMoney(currentPrice)}</p>
                    {product.promotional_price !== null ? (
                      <p className="text-xs text-gray-500 line-through">{formatMoney(product.price)}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      Produção sob encomenda
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => startEditing(product)}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={product.status === "archived"}
                      onClick={() => setArchiveTarget(product)}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-bold text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
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
            ? `“${archiveTarget.name}” deixará de aparecer na loja, mas continuará disponível no histórico administrativo.`
            : "O produto deixará de aparecer na loja."
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
