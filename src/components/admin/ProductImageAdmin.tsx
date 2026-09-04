import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  LoaderCircle,
  Star,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ADMIN_IMAGE_ACCEPT,
  archiveAdminProductImage,
  fetchAdminProductImages,
  saveAdminProductImageOrder,
  setAdminProductPrimaryImage,
  uploadAdminProductImage,
} from "@/lib/admin-product-images";
import { fetchAdminCatalog, type AdminProduct } from "@/lib/admin-products";
import { buildR2PublicImageUrl } from "@/lib/product-images";
import type { ProductImage } from "@/lib/products";

function statusLabel(status: AdminProduct["status"]) {
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

export function ProductImageAdmin() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ProductImage | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setErrorMessage("");

    try {
      const snapshot = await fetchAdminCatalog();
      const availableProducts = snapshot.products.filter(
        (product) => product.status !== "archived",
      );

      setProducts(availableProducts);
      setSelectedProductId((current) => {
        if (
          current &&
          availableProducts.some((product) => product.id === current)
        ) {
          return current;
        }

        return availableProducts[0]?.id ?? "";
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os produtos.",
      );
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadImages = useCallback(async (productId: string) => {
    if (!productId) {
      setImages([]);
      return;
    }

    setLoadingImages(true);

    try {
      setImages(await fetchAdminProductImages(productId));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as imagens do produto.",
      );
    } finally {
      setLoadingImages(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    setErrorMessage("");
    setSuccessMessage("");
    setArchiveTarget(null);
    void loadImages(selectedProductId);
  }, [selectedProductId, loadImages]);

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!selectedProduct || files.length === 0 || uploading) return;

    setUploading(true);
    setErrorMessage("");
    setSuccessMessage("");

    let uploadedCount = 0;
    const failedNames: string[] = [];

    for (const [index, file] of files.entries()) {
      try {
        await uploadAdminProductImage({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          file,
          sortOrder: images.length + index,
        });
        uploadedCount += 1;
      } catch {
        failedNames.push(file.name);
      }
    }

    await loadImages(selectedProduct.id);

    if (uploadedCount > 0) {
      setSuccessMessage(
        uploadedCount === 1
          ? "1 imagem adicionada com sucesso."
          : `${uploadedCount} imagens adicionadas com sucesso.`,
      );
    }

    if (failedNames.length > 0) {
      setErrorMessage(
        failedNames.length === 1
          ? `Não foi possível enviar ${failedNames[0]}. Confira o formato e o tamanho da imagem.`
          : `Não foi possível enviar ${failedNames.length} imagens. Confira formato e tamanho dos arquivos.`,
      );
    }

    setUploading(false);
  }

  async function handlePrimary(imageId: string) {
    if (!selectedProductId || busyImageId) return;

    setBusyImageId(imageId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await setAdminProductPrimaryImage(imageId);
      await loadImages(selectedProductId);
      setSuccessMessage("Imagem principal atualizada.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível definir a imagem principal.",
      );
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!selectedProductId || busyImageId) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;

    const reordered = [...images];
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];

    setBusyImageId(images[index].id);
    setErrorMessage("");
    setSuccessMessage("");
    setImages(reordered);

    try {
      await saveAdminProductImageOrder(reordered.map((image) => image.id));
      await loadImages(selectedProductId);
      setSuccessMessage("Ordem das imagens atualizada.");
    } catch (error) {
      await loadImages(selectedProductId);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a ordem das imagens.",
      );
    } finally {
      setBusyImageId(null);
    }
  }

  async function confirmArchive() {
    const image = archiveTarget;
    if (!image || !selectedProductId || busyImageId) return;

    setBusyImageId(image.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await archiveAdminProductImage(image.id, selectedProductId);
      setArchiveTarget(null);
      await loadImages(selectedProductId);
      setSuccessMessage("Imagem retirada do produto.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível retirar a imagem.",
      );
    } finally {
      setBusyImageId(null);
    }
  }

  return (
    <>
      <section className="mt-10 border-t border-gray-200 pt-8">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-950">
            Imagens dos produtos
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Envie as fotos que aparecem na loja, escolha a principal e ajuste a ordem da galeria.
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="text-sm font-semibold text-gray-800">
              Produto
              <select
                value={selectedProductId}
                disabled={loadingProducts || uploading}
                onChange={(event) => setSelectedProductId(event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {products.length === 0 ? (
                  <option value="">Nenhum produto disponível</option>
                ) : null}
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {statusLabel(product.status)}
                  </option>
                ))}
              </select>
            </label>

            <label
              className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-bold transition ${
                selectedProduct && !uploading
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "cursor-not-allowed bg-gray-200 text-gray-500"
              }`}
            >
              {uploading ? (
                <LoaderCircle
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {uploading ? "Enviando..." : "Adicionar imagens"}
              <input
                type="file"
                multiple
                accept={ADMIN_IMAGE_ACCEPT}
                disabled={!selectedProduct || uploading}
                onChange={(event) => void handleFiles(event)}
                className="sr-only"
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Formatos aceitos: WebP, AVIF, JPEG e PNG. Limite de 15 MB por imagem.
          </p>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
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

          {loadingImages ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Carregando imagens...
            </div>
          ) : !selectedProduct ? (
            <p className="mt-6 text-sm text-gray-500">
              Cadastre um produto antes de adicionar imagens.
            </p>
          ) : images.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">
              <ImagePlus
                className="mx-auto h-7 w-7 text-gray-400"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-bold text-gray-800">
                Este produto ainda não tem imagens.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Use “Adicionar imagens” para enviar a primeira foto.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {images.map((image, index) => {
                const imageUrl = buildR2PublicImageUrl(image.storage_key);
                const busy = busyImageId === image.id;

                return (
                  <article
                    key={image.id}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
                  >
                    <div className="relative aspect-square bg-white">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={
                            image.alt_text?.trim() || selectedProduct.name
                          }
                          className="h-full w-full object-contain p-3"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-500">
                          Prévia indisponível.
                        </div>
                      )}

                      {image.is_primary ? (
                        <span className="absolute left-3 top-3 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm">
                          <Star
                            className="mr-1 h-3.5 w-3.5 fill-current"
                            aria-hidden="true"
                          />
                          Principal
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-3 border-t border-gray-200 bg-white p-4">
                      <p
                        className="truncate text-xs text-gray-500"
                        title={image.original_filename ?? undefined}
                      >
                        {image.original_filename || `Imagem ${index + 1}`}
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy || image.is_primary}
                          onClick={() => void handlePrimary(image.id)}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Star
                            className="mr-1.5 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          {image.is_primary ? "Principal" : "Tornar principal"}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setArchiveTarget(image)}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 bg-white px-3 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2
                            className="mr-1.5 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Retirar
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy || index === 0}
                          onClick={() => void handleMove(index, -1)}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronUp
                            className="mr-1 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Mover antes
                        </button>

                        <button
                          type="button"
                          disabled={busy || index === images.length - 1}
                          onClick={() => void handleMove(index, 1)}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronDown
                            className="mr-1 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Mover depois
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !busyImageId) setArchiveTarget(null);
        }}
        title="Retirar imagem do produto?"
        description="A imagem deixará de aparecer na loja. O arquivo será mantido no armazenamento para evitar exclusões acidentais."
        confirmLabel="Retirar imagem"
        cancelLabel="Manter imagem"
        tone="danger"
        loading={Boolean(archiveTarget && busyImageId === archiveTarget.id)}
        onConfirm={confirmArchive}
      />
    </>
  );
}
