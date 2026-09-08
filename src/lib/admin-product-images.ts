import { supabase } from "@/integrations/supabase/client";
import { createProductImageDerivatives } from "@/lib/image-derivatives";
import type { ProductImage } from "@/lib/products";
import { getUserFacingError } from "@/lib/user-facing-error";

export const ADMIN_IMAGE_ACCEPT = "image/webp,image/avif,image/jpeg,image/png";
export const ADMIN_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/webp", "image/avif", "image/jpeg", "image/png"]);

type UploadTarget = {
  objectKey: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
};

type PresignResponse = {
  imageId: string;
  expiresIn: number;
  uploads: {
    full: UploadTarget;
    card: UploadTarget;
    thumb: UploadTarget;
  };
};

type CompleteResponse = {
  image: ProductImage;
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

  return (data ?? []) as ProductImage[];
}

async function putRendition(target: UploadTarget, body: Blob) {
  const response = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: target.requiredHeaders,
    body,
  });

  if (!response.ok) {
    throw new Error("Não foi possível enviar uma das versões otimizadas da imagem.");
  }
}

export async function uploadAdminProductImage(input: {
  productId: string;
  productName: string;
  file: File;
  sortOrder: number;
  variantId?: string | null;
}): Promise<ProductImage> {
  validateAdminImageFile(input.file);

  let derivatives;
  try {
    derivatives = await createProductImageDerivatives(input.file);
  } catch (error) {
    throw friendlyError(error, "Não foi possível otimizar a imagem selecionada.");
  }

  const { data: presignData, error: presignError } =
    await supabase.functions.invoke<PresignResponse>("r2-image-presign", {
      body: {
        productId: input.productId,
        variantId: input.variantId ?? null,
        originalFilename: input.file.name,
        altText: input.productName,
        sortOrder: input.sortOrder,
        full: {
          byteSize: derivatives.full.blob.size,
          widthPx: derivatives.full.width,
          heightPx: derivatives.full.height,
        },
        card: {
          byteSize: derivatives.card.blob.size,
          widthPx: derivatives.card.width,
          heightPx: derivatives.card.height,
        },
        thumb: {
          byteSize: derivatives.thumb.blob.size,
          widthPx: derivatives.thumb.width,
          heightPx: derivatives.thumb.height,
        },
      },
    });

  if (
    presignError ||
    !presignData?.imageId ||
    !presignData.uploads?.full?.uploadUrl ||
    !presignData.uploads?.card?.uploadUrl ||
    !presignData.uploads?.thumb?.uploadUrl
  ) {
    throw friendlyError(presignError, "Não foi possível preparar o envio da imagem.");
  }

  try {
    await Promise.all([
      putRendition(presignData.uploads.full, derivatives.full.blob),
      putRendition(presignData.uploads.card, derivatives.card.blob),
      putRendition(presignData.uploads.thumb, derivatives.thumb.blob),
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
      body: { imageId: presignData.imageId },
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
