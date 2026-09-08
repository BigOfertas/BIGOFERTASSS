import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";

import {
  assignAdminCatalogImageVariant,
  fetchAdminCatalogPage,
  fetchAdminCatalogProductDetail,
  fetchAdminCatalogTaxonomy,
  saveAdminCatalogProduct,
  saveAdminCatalogVariant,
  type AdminCatalogPage,
  type AdminCatalogProductDetail,
  type AdminCatalogStatus,
  type AdminCatalogVariant,
  type AdminTaxonomySnapshot,
  type AdminVariantOption,
} from "@/lib/admin-catalog-foundation";
import {
  ADMIN_IMAGE_ACCEPT,
  archiveAdminProductImage,
  setAdminProductPrimaryImage,
  uploadAdminProductImage,
} from "@/lib/admin-product-images";
import { buildR2PublicImageUrl } from "@/lib/product-images";

const PAGE_SIZE = 25;

const COMMERCIAL_TYPES: Array<[AdminCatalogProductDetail["commercialType"], string]> = [
  ["torcedor", "Torcedor"],
  ["jogador", "Jogador"],
  ["feminino", "Feminino"],
  ["infantil", "Infantil / Kids"],
  ["retro", "Retrô"],
  ["calcao", "Calção / Short"],
  ["basquete", "Basquete"],
  ["other", "Outro"],
];

const OPTION_KINDS: Array<[AdminVariantOption["kind"], string]> = [
  ["version", "Versão"],
  ["color", "Cor"],
  ["size", "Tamanho"],
  ["gender", "Público"],
  ["other", "Outro"],
];

const EMPTY_PRODUCT = {
  name: "",
  description: "",
  price: "",
  promotionalPrice: "",
  status: "draft" as AdminCatalogStatus,
  primaryCategoryId: "",
  competitionField: "campeonato" as "campeonato" | "liga",
  competition: "",
  time: "",
  season: "",
  brand: "",
  audience: "",
  commercialType: "other" as AdminCatalogProductDetail["commercialType"],
  weightGrams: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
};

type ProductDraft = typeof EMPTY_PRODUCT;

type VariantDraft = {
  id: string | null;
  name: string;
  status: AdminCatalogVariant["status"];
  isDefault: boolean;
  priceOverride: string;
  promotionalPriceOverride: string;
  stockQuantity: string;
  options: AdminVariantOption[];
};

function numberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error("Há um campo numérico inválido.");
  return parsed;
}

function productToDraft(product: AdminCatalogProductDetail): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? "",
    price: String(product.price),
    promotionalPrice: product.promotionalPrice === null ? "" : String(product.promotionalPrice),
    status: product.status,
    primaryCategoryId: product.primaryCategoryId ?? "",
    competitionField: product.liga ? "liga" : "campeonato",
    competition: product.liga ?? product.campeonato ?? "",
    time: product.time ?? "",
    season: product.season ?? "",
    brand: product.brand ?? "",
    audience: product.audience ?? "",
    commercialType: product.commercialType,
    weightGrams: product.weightGrams === null ? "" : String(product.weightGrams),
    lengthCm: product.lengthCm === null ? "" : String(product.lengthCm),
    widthCm: product.widthCm === null ? "" : String(product.widthCm),
    heightCm: product.heightCm === null ? "" : String(product.heightCm),
  };
}

function variantToDraft(variant?: AdminCatalogVariant): VariantDraft {
  if (!variant) {
    return {
      id: null,
      name: "Nova versão",
      status: "active",
      isDefault: false,
      priceOverride: "",
      promotionalPriceOverride: "",
      stockQuantity: "0",
      options: [{ name: "Versão", kind: "version", value: "" }],
    };
  }

  return {
    id: variant.id,
    name: variant.name ?? "",
    status: variant.status,
    isDefault: variant.isDefault,
    priceOverride: variant.priceOverride === null ? "" : String(variant.priceOverride),
    promotionalPriceOverride:
      variant.promotionalPriceOverride === null ? "" : String(variant.promotionalPriceOverride),
    stockQuantity: String(variant.stockQuantity),
    options: variant.options.map((option) => ({ ...option })),
  };
}

function fieldClassName() {
  return "mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10";
}

export function CatalogFoundationAdmin() {
  const [catalog, setCatalog] = useState<AdminCatalogPage | null>(null);
  const [taxonomy, setTaxonomy] = useState<AdminTaxonomySnapshot | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminCatalogStatus | "">("");
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminCatalogProductDetail | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(EMPTY_PRODUCT);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [variantDraft, setVariantDraft] = useState<VariantDraft | null>(null);
  const [uploadVariantId, setUploadVariantId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError("");
    try {
      const data = await fetchAdminCatalogPage({ query, status, page, pageSize: PAGE_SIZE });
      setCatalog(data);
      if (data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o catálogo.");
    } finally {
      setLoadingList(false);
    }
  }, [page, query, status]);

  const loadTaxonomy = useCallback(async () => {
    try {
      setTaxonomy(await fetchAdminCatalogTaxonomy());
    } catch {
      setTaxonomy(null);
    }
  }, []);

  const loadDetail = useCallback(async (productId: string) => {
    setLoadingDetail(true);
    setError("");
    try {
      const data = await fetchAdminCatalogProductDetail(productId);
      setDetail(data);
      setProductDraft(productToDraft(data));
      setVariantDraft(null);
      setUploadVariantId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o produto.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadList(), loadTaxonomy()]);
  }, [loadList, loadTaxonomy]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  const taxonomyByKind = useMemo(() => {
    const items = taxonomy?.items ?? [];
    return {
      competitions: items.filter((item) => item.kind === "competition"),
      teams: items.filter((item) => item.kind === "team"),
      brands: items.filter((item) => item.kind === "brand"),
      seasons: items.filter((item) => item.kind === "season"),
      audiences: items.filter((item) => item.kind === "audience"),
    };
  }, [taxonomy]);

  const visibleTeams = useMemo(() => {
    const competition = taxonomyByKind.competitions.find(
      (item) => item.name.toLocaleLowerCase("pt-BR") === productDraft.competition.toLocaleLowerCase("pt-BR"),
    );
    if (!competition) return taxonomyByKind.teams;
    const linked = taxonomyByKind.teams.filter((team) =>
      team.parents.some((parent) => parent.id === competition.id),
    );
    return linked.length > 0 ? linked : taxonomyByKind.teams;
  }, [productDraft.competition, taxonomyByKind]);

  function startNewProduct() {
    setSelectedId(null);
    setDetail(null);
    setProductDraft(EMPTY_PRODUCT);
    setVariantDraft(null);
    setMessage("");
    setError("");
  }

  async function saveProduct() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const price = numberOrNull(productDraft.price);
      if (price === null || price < 0 || !productDraft.name.trim()) {
        throw new Error("Informe nome e preço válidos.");
      }
      const promotionalPrice = numberOrNull(productDraft.promotionalPrice);
      if (promotionalPrice !== null && promotionalPrice >= price) {
        throw new Error("O preço promocional precisa ser menor que o preço normal.");
      }
      const lengthCm = numberOrNull(productDraft.lengthCm);
      const widthCm = numberOrNull(productDraft.widthCm);
      const heightCm = numberOrNull(productDraft.heightCm);
      const dimensionCount = [lengthCm, widthCm, heightCm].filter((value) => value !== null).length;
      if (dimensionCount !== 0 && dimensionCount !== 3) {
        throw new Error("Preencha as três dimensões ou deixe todas vazias.");
      }

      const savedId = await saveAdminCatalogProduct({
        id: detail?.id ?? null,
        name: productDraft.name,
        description: productDraft.description,
        price,
        promotionalPrice,
        status: productDraft.status,
        primaryCategoryId: productDraft.primaryCategoryId || null,
        campeonato: productDraft.competitionField === "campeonato" ? productDraft.competition : "",
        liga: productDraft.competitionField === "liga" ? productDraft.competition : "",
        time: productDraft.time,
        season: productDraft.season,
        brand: productDraft.brand,
        audience: productDraft.audience,
        commercialType: productDraft.commercialType,
        weightGrams: numberOrNull(productDraft.weightGrams),
        lengthCm,
        widthCm,
        heightCm,
      });

      setSelectedId(savedId);
      await Promise.all([loadDetail(savedId), loadList(), loadTaxonomy()]);
      setMessage(
        productDraft.status === "active" && (detail?.images.length ?? 0) === 0
          ? "Produto salvo. Ele só aparecerá na loja quando tiver pelo menos uma imagem pronta."
          : "Produto salvo com sucesso.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  async function saveVariant() {
    if (!detail || !variantDraft || saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const stock = Number(variantDraft.stockQuantity);
      if (!Number.isInteger(stock) || stock < 0) throw new Error("Estoque da variação inválido.");
      await saveAdminCatalogVariant({
        productId: detail.id,
        variantId: variantDraft.id,
        name: variantDraft.name,
        status: variantDraft.status,
        isDefault: variantDraft.isDefault,
        priceOverride: numberOrNull(variantDraft.priceOverride),
        promotionalPriceOverride: numberOrNull(variantDraft.promotionalPriceOverride),
        stockQuantity: stock,
        options: variantDraft.options.filter((option) => option.name.trim() && option.value.trim()),
      });
      await loadDetail(detail.id);
      await loadList();
      setVariantDraft(null);
      setMessage("Variação salva com sucesso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a variação.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!detail || files.length === 0 || uploading) return;
    setUploading(true);
    setMessage("");
    setError("");
    let success = 0;
    try {
      const baseCount = detail.images.filter(
        (image) => image.variantId === (uploadVariantId || null),
      ).length;
      for (const [index, file] of files.entries()) {
        await uploadAdminProductImage({
          productId: detail.id,
          productName: detail.name,
          file,
          sortOrder: baseCount + index,
          variantId: uploadVariantId || null,
        });
        success += 1;
      }
      await loadDetail(detail.id);
      await loadList();
      setMessage(`${success} ${success === 1 ? "imagem adicionada" : "imagens adicionadas"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar as imagens.");
    } finally {
      setUploading(false);
    }
  }

  async function assignImage(imageId: string, variantId: string | null) {
    if (!detail || busyImageId) return;
    setBusyImageId(imageId);
    setError("");
    try {
      await assignAdminCatalogImageVariant({ productId: detail.id, imageId, variantId });
      await loadDetail(detail.id);
      setMessage("Imagem vinculada à galeria correta.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível mover a imagem.");
    } finally {
      setBusyImageId(null);
    }
  }

  async function makePrimary(imageId: string) {
    if (!detail || busyImageId) return;
    setBusyImageId(imageId);
    try {
      await setAdminProductPrimaryImage(imageId);
      await loadDetail(detail.id);
      setMessage("Imagem principal atualizada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a imagem principal.");
    } finally {
      setBusyImageId(null);
    }
  }

  async function removeImage(imageId: string) {
    if (!detail || busyImageId) return;
    setBusyImageId(imageId);
    try {
      await archiveAdminProductImage(imageId, detail.id);
      await Promise.all([loadDetail(detail.id), loadList()]);
      setMessage("Imagem retirada do produto.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível retirar a imagem.");
    } finally {
      setBusyImageId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">Catálogo definitivo</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-950">Produtos</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Busca e paginação no banco, taxonomia aberta, variações reais e imagens gerais ou por versão.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewProduct}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700"
        >
          <Plus className="mr-2 h-4 w-4" /> Novo produto
        </button>
      </div>

      {message ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4 xl:sticky xl:top-24">
          <div className="flex gap-2">
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setPage(1);
                  setQuery(queryInput.trim());
                }
              }}
              placeholder="Buscar produto"
              className="h-10 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-red-500"
            />
            <button
              type="button"
              aria-label="Buscar"
              onClick={() => {
                setPage(1);
                setQuery(queryInput.trim());
              }}
              className="h-10 rounded-md border border-gray-300 px-3 text-xs font-bold hover:border-red-400"
            >
              Buscar
            </button>
          </div>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as AdminCatalogStatus | "");
            }}
            className="mt-2 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="draft">Rascunhos</option>
            <option value="inactive">Inativos</option>
            <option value="archived">Arquivados</option>
          </select>

          <div className="mt-4 min-h-40 space-y-2">
            {loadingList ? (
              <div className="flex items-center gap-2 py-8 text-sm text-gray-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...</div>
            ) : catalog?.items.length ? (
              catalog.items.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedId(product.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selectedId === product.id ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <p className="line-clamp-2 text-sm font-bold text-gray-950">{product.name}</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {product.variantCount} var. · {product.readyImageCount} imagens · {product.status}
                  </p>
                </button>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-gray-500">Nenhum produto encontrado.</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex h-8 items-center rounded border px-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span>{catalog?.total ?? 0} produtos · pág. {catalog?.page ?? page}/{Math.max(1, catalog?.totalPages ?? 1)}</span>
            <button type="button" disabled={!catalog || page >= catalog.totalPages} onClick={() => setPage((value) => value + 1)} className="inline-flex h-8 items-center rounded border px-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {loadingDetail ? (
            <div className="flex min-h-60 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Carregando produto...</div>
          ) : detail || selectedId === null ? (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-gray-950">{detail ? "Editar produto" : "Novo produto"}</h2>
                    <p className="mt-1 text-xs text-gray-500">Novas seleções, clubes, marcas e temporadas podem ser digitados livremente; passam a fazer parte da taxonomia após salvar.</p>
                  </div>
                  <button type="button" disabled={saving} onClick={() => void saveProduct()} className="inline-flex h-10 items-center rounded-lg bg-gray-950 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"><Save className="mr-2 h-4 w-4" /> Salvar</button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold md:col-span-2">Nome<input value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} className={fieldClassName()} /></label>
                  <label className="text-sm font-semibold md:col-span-2">Descrição<textarea value={productDraft.description} onChange={(event) => setProductDraft({ ...productDraft, description: event.target.value })} className="mt-1 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-500" /></label>
                  <label className="text-sm font-semibold">Preço<input inputMode="decimal" value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })} className={fieldClassName()} /></label>
                  <label className="text-sm font-semibold">Preço promocional<input inputMode="decimal" value={productDraft.promotionalPrice} onChange={(event) => setProductDraft({ ...productDraft, promotionalPrice: event.target.value })} className={fieldClassName()} /></label>
                  <label className="text-sm font-semibold">Status<select value={productDraft.status} onChange={(event) => setProductDraft({ ...productDraft, status: event.target.value as AdminCatalogStatus })} className={fieldClassName()}><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="archived">Arquivado</option></select></label>
                  <label className="text-sm font-semibold">Categoria<select value={productDraft.primaryCategoryId} onChange={(event) => setProductDraft({ ...productDraft, primaryCategoryId: event.target.value })} className={fieldClassName()}><option value="">Sem categoria</option>{(taxonomy?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>

                  <label className="text-sm font-semibold">Tipo de competição<select value={productDraft.competitionField} onChange={(event) => setProductDraft({ ...productDraft, competitionField: event.target.value as "campeonato" | "liga" })} className={fieldClassName()}><option value="campeonato">Campeonato / seleção</option><option value="liga">Liga</option></select></label>
                  <label className="text-sm font-semibold">Competição<input list="catalog-competitions" value={productDraft.competition} onChange={(event) => setProductDraft({ ...productDraft, competition: event.target.value })} className={fieldClassName()} /><datalist id="catalog-competitions">{taxonomyByKind.competitions.map((item) => <option key={item.id} value={item.name} />)}</datalist></label>
                  <label className="text-sm font-semibold">Time / seleção<input list="catalog-teams" value={productDraft.time} onChange={(event) => setProductDraft({ ...productDraft, time: event.target.value })} className={fieldClassName()} /><datalist id="catalog-teams">{visibleTeams.map((item) => <option key={item.id} value={item.name} />)}</datalist></label>
                  <label className="text-sm font-semibold">Temporada<input list="catalog-seasons" value={productDraft.season} onChange={(event) => setProductDraft({ ...productDraft, season: event.target.value })} className={fieldClassName()} /><datalist id="catalog-seasons">{taxonomyByKind.seasons.map((item) => <option key={item.id} value={item.name} />)}</datalist></label>
                  <label className="text-sm font-semibold">Marca<input list="catalog-brands" value={productDraft.brand} onChange={(event) => setProductDraft({ ...productDraft, brand: event.target.value })} className={fieldClassName()} /><datalist id="catalog-brands">{taxonomyByKind.brands.map((item) => <option key={item.id} value={item.name} />)}</datalist></label>
                  <label className="text-sm font-semibold">Público<input list="catalog-audiences" value={productDraft.audience} onChange={(event) => setProductDraft({ ...productDraft, audience: event.target.value })} className={fieldClassName()} placeholder="Masculino, Feminino, Kids..." /><datalist id="catalog-audiences">{taxonomyByKind.audiences.map((item) => <option key={item.id} value={item.name} />)}</datalist></label>
                  <label className="text-sm font-semibold">Modelo comercial<select value={productDraft.commercialType} onChange={(event) => setProductDraft({ ...productDraft, commercialType: event.target.value as AdminCatalogProductDetail["commercialType"] })} className={fieldClassName()}>{COMMERCIAL_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>

                  <label className="text-sm font-semibold">Peso (g)<input inputMode="numeric" value={productDraft.weightGrams} onChange={(event) => setProductDraft({ ...productDraft, weightGrams: event.target.value })} className={fieldClassName()} /></label>
                  <div className="grid grid-cols-3 gap-2 md:col-span-2"><label className="text-xs font-semibold">Comprimento (cm)<input value={productDraft.lengthCm} onChange={(event) => setProductDraft({ ...productDraft, lengthCm: event.target.value })} className={fieldClassName()} /></label><label className="text-xs font-semibold">Largura (cm)<input value={productDraft.widthCm} onChange={(event) => setProductDraft({ ...productDraft, widthCm: event.target.value })} className={fieldClassName()} /></label><label className="text-xs font-semibold">Altura (cm)<input value={productDraft.heightCm} onChange={(event) => setProductDraft({ ...productDraft, heightCm: event.target.value })} className={fieldClassName()} /></label></div>
                </div>
                {productDraft.status === "active" && (detail?.images.length ?? 0) === 0 ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Pode salvar como ativo, mas ele não será exibido publicamente até possuir ao menos uma imagem pronta.</p> : null}
              </div>

              {detail ? (
                <>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-gray-950">Variações</h2><p className="mt-1 text-sm text-gray-500">Um produto-base pode ter várias versões sem ganhar outro código comercial.</p></div><button type="button" onClick={() => setVariantDraft(variantToDraft())} className="inline-flex h-9 items-center rounded-lg border border-gray-300 px-3 text-xs font-bold"><Plus className="mr-1.5 h-4 w-4" /> Nova variação</button></div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{detail.variants.map((variant) => <button key={variant.id} type="button" onClick={() => setVariantDraft(variantToDraft(variant))} className="rounded-lg border border-gray-200 p-3 text-left hover:border-red-300"><p className="font-bold text-gray-950">{variant.name || "Sem nome"}{variant.isDefault ? " · padrão" : ""}</p><p className="mt-1 text-xs text-gray-500">{variant.options.map((option) => `${option.name}: ${option.value}`).join(" · ") || "Sem opções"}</p><p className="mt-1 text-[11px] text-gray-400">{variant.status} · estoque {variant.stockQuantity}</p></button>)}</div>

                    {variantDraft ? <div className="mt-5 border-t border-gray-100 pt-5"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Nome da variação<input value={variantDraft.name} onChange={(event) => setVariantDraft({ ...variantDraft, name: event.target.value })} className={fieldClassName()} /></label><label className="text-sm font-semibold">Status<select value={variantDraft.status} onChange={(event) => setVariantDraft({ ...variantDraft, status: event.target.value as AdminCatalogVariant["status"] })} className={fieldClassName()}><option value="active">Ativa</option><option value="inactive">Inativa</option><option value="archived">Arquivada</option></select></label><label className="text-sm font-semibold">Preço próprio (opcional)<input value={variantDraft.priceOverride} onChange={(event) => setVariantDraft({ ...variantDraft, priceOverride: event.target.value })} className={fieldClassName()} /></label><label className="text-sm font-semibold">Promocional próprio<input value={variantDraft.promotionalPriceOverride} onChange={(event) => setVariantDraft({ ...variantDraft, promotionalPriceOverride: event.target.value })} className={fieldClassName()} /></label><label className="text-sm font-semibold">Estoque<input inputMode="numeric" value={variantDraft.stockQuantity} onChange={(event) => setVariantDraft({ ...variantDraft, stockQuantity: event.target.value })} className={fieldClassName()} /></label><label className="mt-6 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={variantDraft.isDefault} onChange={(event) => setVariantDraft({ ...variantDraft, isDefault: event.target.checked })} /> Variação padrão</label></div>
                    <div className="mt-5"><div className="flex items-center justify-between"><h3 className="font-black text-gray-950">Opções desta versão</h3><button type="button" onClick={() => setVariantDraft({ ...variantDraft, options: [...variantDraft.options, { name: "", kind: "other", value: "" }] })} className="text-xs font-bold text-red-600">+ opção</button></div><div className="mt-3 space-y-2">{variantDraft.options.map((option, index) => <div key={`${option.optionId ?? "new"}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_130px_1fr_auto]"><input placeholder="Ex.: Versão" value={option.name} onChange={(event) => { const options = [...variantDraft.options]; options[index] = { ...option, name: event.target.value }; setVariantDraft({ ...variantDraft, options }); }} className="h-9 rounded-md border border-gray-300 px-2 text-sm" /><select value={option.kind} onChange={(event) => { const options = [...variantDraft.options]; options[index] = { ...option, kind: event.target.value as AdminVariantOption["kind"] }; setVariantDraft({ ...variantDraft, options }); }} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm">{OPTION_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input placeholder="Ex.: Regata + short" value={option.value} onChange={(event) => { const options = [...variantDraft.options]; options[index] = { ...option, value: event.target.value }; setVariantDraft({ ...variantDraft, options }); }} className="h-9 rounded-md border border-gray-300 px-2 text-sm" /><button type="button" aria-label="Remover opção" onClick={() => setVariantDraft({ ...variantDraft, options: variantDraft.options.filter((_, optionIndex) => optionIndex !== index) })} className="h-9 rounded-md border border-gray-200 px-2 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div></div>
                    <div className="mt-5 flex gap-2"><button type="button" disabled={saving} onClick={() => void saveVariant()} className="h-10 rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">Salvar variação</button><button type="button" onClick={() => setVariantDraft(null)} className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-bold">Cancelar</button></div></div> : null}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black text-gray-950">Imagens gerais e por variação</h2><p className="mt-1 text-sm text-gray-500">Envie para a galeria geral ou diretamente para uma versão específica.</p></div><div className="flex flex-wrap gap-2"><select value={uploadVariantId} onChange={(event) => setUploadVariantId(event.target.value)} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"><option value="">Galeria geral</option>{detail.variants.filter((variant) => variant.status !== "archived").map((variant) => <option key={variant.id} value={variant.id}>{variant.name || "Variação"}</option>)}</select><label className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-bold ${uploading ? "bg-gray-200 text-gray-500" : "cursor-pointer bg-red-600 text-white hover:bg-red-700"}`}>{uploading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}{uploading ? "Enviando" : "Adicionar imagens"}<input type="file" multiple accept={ADMIN_IMAGE_ACCEPT} disabled={uploading} onChange={(event) => void handleImages(event)} className="sr-only" /></label></div></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{detail.images.map((image) => { const url = buildR2PublicImageUrl(image.storageKey); const variant = detail.variants.find((item) => item.id === image.variantId); return <article key={image.id} className="overflow-hidden rounded-lg border border-gray-200"><div className="flex aspect-[4/5] items-center justify-center bg-gray-50">{url ? <img src={url} alt={image.altText ?? detail.name} loading="lazy" className="h-full w-full object-contain p-2" /> : <span className="text-xs text-gray-400">Imagem</span>}</div><div className="space-y-2 p-3"><p className="truncate text-xs font-bold text-gray-900">{variant?.name ?? "Galeria geral"}{image.isPrimary ? " · principal" : ""}</p><select value={image.variantId ?? ""} disabled={busyImageId === image.id} onChange={(event) => void assignImage(image.id, event.target.value || null)} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs"><option value="">Galeria geral</option>{detail.variants.map((item) => <option key={item.id} value={item.id}>{item.name || "Variação"}</option>)}</select><div className="flex gap-2"><button type="button" disabled={busyImageId === image.id} onClick={() => void makePrimary(image.id)} className="inline-flex h-8 flex-1 items-center justify-center rounded border border-gray-200 text-[11px] font-bold hover:text-red-600"><Star className="mr-1 h-3.5 w-3.5" /> Principal</button><button type="button" disabled={busyImageId === image.id} onClick={() => void removeImage(image.id)} className="inline-flex h-8 w-9 items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div></div></article>; })}</div>
                    {detail.images.length === 0 ? <p className="mt-5 rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">Nenhuma imagem pronta ainda.</p> : null}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center"><RefreshCw className="h-6 w-6 text-gray-300" /><p className="mt-3 font-bold text-gray-900">Selecione um produto</p><p className="mt-1 text-sm text-gray-500">Use a lista paginada ao lado para editar.</p></div>
          )}
        </div>
      </div>
    </section>
  );
}
