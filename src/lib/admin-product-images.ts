import { supabase } from "@/integrations/supabase/client";
import type { ProductImage } from "@/lib/products";
import { getUserFacingError } from "@/lib/user-facing-error";

export const ADMIN_IMAGE_ACCEPT = "image/webp,image/avif,image/jpeg,image/png";
export const ADMIN_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/webp", "image/avif", "image/jpeg", "image/png"]);
const OUTPUT_MIME = "image/webp";
const MAIN_MAX_EDGE = 1800;
const CARD_MAX_EDGE = 760;
const THUMB_MAX_EDGE = 280;
const WEBP_QUALITY = 0.9;

type DerivativeName = "main" | "card" | "thumb";

type PresignUpload = {
  objectKey: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
};

type PresignResponse = {
  imageId: string;
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
  method: "PUT";
  requiredHeaders: Record<string, string>;
  derivativeUploads?: Record<DerivativeName, PresignUpload>;
};

type CompleteResponse = {
  image: ProductImage;
};

type ProcessedImage = {
  main: Blob;
  card: Blob;
  thumb: Blob;
  width: number;
  height: number;
};

function friendlyError(error: unknown, fallback: string) {
  return new Error(getUserFacingError(error, fallback));
}

export function validateAdminImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Formato não aceito. Use WebP, AVIF, JPEG ou PNG.");
  }

  if (file.size <= 0) {
    throw new Error("A imagem selecionada está vazia.");
  }

  if (file.size > ADMIN_IMAGE_MAX_BYTES) {
    throw new Error("A imagem é maior que 15 MB.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível preparar a imagem em WebP."));
      },
      OUTPUT_MIME,
      WEBP_QUALITY,
    );
  });
}

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (context: CanvasRenderingContext2D, width: number, height: number) =>
        context.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível abrir a imagem selecionada."));
      element.src = objectUrl;
    });
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (context: CanvasRenderingContext2D, width: number, height: number) =>
        context.drawImage(image, 0, 0, width, height),
      close: () => undefined,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function fittedSize(width: number, height: number, maxEdge: number) {
  const largest = Math.max(width, height);
  if (largest <= maxEdge) return { width, height };
  const scale = maxEdge / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function renderDerivative(source: Awaited<ReturnType<typeof decodeImage>>, maxEdge: number) {
  const size = fittedSize(source.width, source.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Seu navegador não conseguiu preparar a imagem.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  source.draw(context, size.width, size.height);
  return { blob: await canvasToBlob(canvas), ...size };
}

async function processProductImage(file: File): Promise<ProcessedImage> {
  const source = await decodeImage(file);
  try {
    const [main, card, thumb] = await Promise.all([
      renderDerivative(source, MAIN_MAX_EDGE),
      renderDerivative(source, CARD_MAX_EDGE),
      renderDerivative(source, THUMB_MAX_EDGE),
    ]);
    return {
      main: main.blob,
      card: card.blob,
      thumb: thumb.blob,
      width: main.width,
      height: main.height,
    };
  } finally {
    source.close();
  }
}

async function putDerivative(upload: PresignUpload, blob: Blob) {
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.requiredHeaders,
    body: blob,
  });
  if (!response.ok) throw new Error("Não foi possível enviar uma das versões da imagem.");
}

export async function fetchAdminProductImages(
  productId: string,
  variantId: string | null | "all" = null,
): Promise<ProductImage[]> {
  let query = supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "ready")
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (variantId === null) query = query.is("variant_id", null);
  else if (variantId !== "all") query = query.eq("variant_id", variantId);

  const { data, error } = await query;

  if (error) {
    throw friendlyError(error, "Não foi possível carregar as imagens do produto.");
  }

  return data ?? [];
}

export async function uploadAdminProductImage(input: {
  productId: string;
  productName: string;
  file: File;
  sortOrder: number;
  variantId?: string | null;
}): Promise<ProductImage> {
  validateAdminImageFile(input.file);
  const processed = await processProductImage(input.file);

  const { data: presignData, error: presignError } =
    await supabase.functions.invoke<PresignResponse>("r2-image-presign", {
      body: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        contentType: OUTPUT_MIME,
        originalFilename: input.file.name,
        altText: input.productName,
        byteSize: processed.main.size,
        cardByteSize: processed.card.size,
        thumbByteSize: processed.thumb.size,
        sortOrder: input.sortOrder,
      },
    });

  if (presignError || !presignData?.imageId || !presignData.uploadUrl) {
    throw friendlyError(presignError, "Não foi possível preparar o envio da imagem.");
  }

  const uploads = presignData.derivativeUploads ?? {
    main: {
      objectKey: presignData.objectKey,
      uploadUrl: presignData.uploadUrl,
      requiredHeaders: presignData.requiredHeaders,
    },
    card: {
      objectKey: presignData.objectKey,
      uploadUrl: presignData.uploadUrl,
      requiredHeaders: presignData.requiredHeaders,
    },
    thumb: {
      objectKey: presignData.objectKey,
      uploadUrl: presignData.uploadUrl,
      requiredHeaders: presignData.requiredHeaders,
    },
  };

  try {
    await Promise.all([
      putDerivative(uploads.main, processed.main),
      putDerivative(uploads.card, processed.card),
      putDerivative(uploads.thumb, processed.thumb),
    ]);
  } catch (error) {
    await supabase
      .from("product_images")
      .update({ status: "failed", is_primary: false })
      .eq("id", presignData.imageId);
    throw friendlyError(error, "Não foi possível enviar a imagem agora.");
  }

  const { data: completeData, error: completeError } =
    await supabase.functions.invoke<CompleteResponse>("r2-image-complete", {
      body: {
        imageId: presignData.imageId,
        widthPx: processed.width,
        heightPx: processed.height,
      },
    });

  if (completeError || !completeData?.image) {
    throw friendlyError(
      completeError,
      "A imagem foi enviada, mas não foi possível confirmar o cadastro.",
    );
  }

  return completeData.image;
}

export async function setAdminProductPrimaryImage(imageId: string): Promise<void> {
  const { error } = await supabase.rpc("set_primary_product_image", {
    target_image_id: imageId,
  });

  if (error) {
    throw friendlyError(error, "Não foi possível definir a imagem principal.");
  }
}

export async function saveAdminProductImageOrder(imageIds: string[]): Promise<void> {
  for (const [index, imageId] of imageIds.entries()) {
    const { error } = await supabase
      .from("product_images")
      .update({ sort_order: index })
      .eq("id", imageId);

    if (error) {
      throw friendlyError(error, "Não foi possível salvar a ordem das imagens.");
    }
  }
}

export async function archiveAdminProductImage(imageId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from("product_images")
    .update({ status: "archived", is_primary: false })
    .eq("id", imageId)
    .eq("product_id", productId);

  if (error) {
    throw friendlyError(error, "Não foi possível retirar a imagem do produto.");
  }
}
