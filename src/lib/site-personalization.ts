import { supabase } from "@/integrations/supabase/client";
import { buildR2PublicImageUrl } from "@/lib/product-images";
import { callSupabaseRpc } from "@/lib/supabase-rpc";
import { getUserFacingError } from "@/lib/user-facing-error";

export const SITE_ASSET_ACCEPT = "image/webp,image/avif,image/jpeg,image/png";
export const SITE_ASSET_MAX_BYTES = 15 * 1024 * 1024;

export const SITE_ASSET_SLOT_KEYS = [
  "top_banner_desktop",
  "top_banner_mobile",
  "hero_desktop",
  "hero_mobile",
  "brasileirao_banner_desktop",
  "brasileirao_banner_mobile",
  "ambient_banner_desktop",
  "ambient_banner_mobile",
  "category_kids",
  "category_training",
  "category_shorts",
  "category_basketball",
  "category_windbreaker",
  "category_fifa",
  "category_retro",
] as const;

export type SiteAssetSlotKey = (typeof SITE_ASSET_SLOT_KEYS)[number];

export type SiteAssetDefinition = {
  key: SiteAssetSlotKey;
  group: "top" | "hero" | "brasileirao" | "ambient" | "categories";
  label: string;
  device: "PC" | "Mobile" | "PC e Mobile";
  width: number;
  height: number;
  format: string;
  behavior: string;
};

export const SITE_ASSET_DEFINITIONS: SiteAssetDefinition[] = [
  { key: "top_banner_desktop", group: "top", label: "Carrossel superior", device: "PC", width: 1920, height: 100, format: "WebP recomendado; PNG se houver transparência", behavior: "Carrossel infinito, sem pausar ao passar o mouse." },
  { key: "top_banner_mobile", group: "top", label: "Carrossel superior", device: "Mobile", width: 1080, height: 169, format: "WebP recomendado; PNG se houver transparência", behavior: "Carrossel infinito, sem pausar ao tocar ou passar o mouse." },
  { key: "hero_desktop", group: "hero", label: "Banner abaixo do cabeçalho", device: "PC", width: 1920, height: 550, format: "WebP recomendado; PNG se houver transparência", behavior: "Banner visual. O clique não executa nenhuma ação." },
  { key: "hero_mobile", group: "hero", label: "Banner abaixo do cabeçalho", device: "Mobile", width: 1080, height: 1067, format: "WebP recomendado; PNG se houver transparência", behavior: "Banner visual. O toque não executa nenhuma ação." },
  { key: "brasileirao_banner_desktop", group: "brasileirao", label: "Banner Brasileirão", device: "PC", width: 1920, height: 360, format: "WebP recomendado; PNG se houver transparência", behavior: "Ao clicar, rola para a seção de produtos do Brasileirão." },
  { key: "brasileirao_banner_mobile", group: "brasileirao", label: "Banner Brasileirão", device: "Mobile", width: 1080, height: 540, format: "WebP recomendado; PNG se houver transparência", behavior: "Ao tocar, rola para a seção de produtos do Brasileirão." },
  { key: "ambient_banner_desktop", group: "ambient", label: "Faixa entre Monte seu pedido e Brasileirão", device: "PC", width: 1920, height: 208, format: "WebP recomendado; PNG se houver transparência", behavior: "Faixa visual sem ação de clique." },
  { key: "ambient_banner_mobile", group: "ambient", label: "Faixa entre Monte seu pedido e Brasileirão", device: "Mobile", width: 1080, height: 443, format: "WebP recomendado; PNG se houver transparência", behavior: "Faixa visual sem ação de clique." },
  { key: "category_kids", group: "categories", label: "Conjunto infantil / Kids", device: "PC e Mobile", width: 800, height: 1200, format: "WebP recomendado", behavior: "Abre a categoria Kids." },
  { key: "category_training", group: "categories", label: "Conjunto de treino / Kits", device: "PC e Mobile", width: 800, height: 1200, format: "WebP recomendado", behavior: "Abre Kits de Treino." },
  { key: "category_shorts", group: "categories", label: "Short", device: "PC e Mobile", width: 800, height: 1200, format: "WebP recomendado", behavior: "Abre Shorts." },
  { key: "category_basketball", group: "categories", label: "Basquete / NBA", device: "PC e Mobile", width: 800, height: 1200, format: "WebP recomendado", behavior: "Abre Basquete / NBA." },
  { key: "category_windbreaker", group: "categories", label: "Corta-vento / Windbreaker", device: "PC e Mobile", width: 800, height: 1200, format: "WebP recomendado", behavior: "Abre Corta-vento." },
  { key: "category_fifa", group: "categories", label: "Mundo FIFA", device: "PC e Mobile", width: 800, height: 1200, format: "WebP recomendado", behavior: "Abre Mundo FIFA." },
  { key: "category_retro", group: "categories", label: "Camisas retrô", device: "PC e Mobile", width: 800, height: 1200, format: "WebP recomendado", behavior: "Abre Camisas Retrô." },
];

export type SiteAsset = {
  slotKey: SiteAssetSlotKey;
  storageKey: string;
  mimeType: string | null;
  widthPx: number | null;
  heightPx: number | null;
  byteSize: number | null;
  updatedAt: string | null;
  url: string | null;
};

export type StorefrontPersonalization = Partial<Record<SiteAssetSlotKey, SiteAsset>>;

type PresignResponse = {
  uploadId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
};

type CompleteResponse = {
  asset: {
    slotKey: SiteAssetSlotKey;
    storageKey: string;
    mimeType?: string | null;
    widthPx?: number | null;
    heightPx?: number | null;
    byteSize?: number | null;
  };
};

const ALLOWED_TYPES = new Set(["image/webp", "image/avif", "image/jpeg", "image/png"]);

function numberOrNull(value: unknown) {
  const numeric = Number(value);
  return value === null || value === undefined || !Number.isFinite(numeric) ? null : numeric;
}

function parsePersonalization(value: unknown): StorefrontPersonalization {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const result: StorefrontPersonalization = {};

  for (const key of SITE_ASSET_SLOT_KEYS) {
    const raw = record[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const storageKey = typeof row.storageKey === "string" ? row.storageKey.trim() : "";
    if (!storageKey) continue;
    result[key] = {
      slotKey: key,
      storageKey,
      mimeType: typeof row.mimeType === "string" ? row.mimeType : null,
      widthPx: numberOrNull(row.widthPx),
      heightPx: numberOrNull(row.heightPx),
      byteSize: numberOrNull(row.byteSize),
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
      url: buildR2PublicImageUrl(storageKey),
    };
  }

  return result;
}

export async function fetchStorefrontPersonalization() {
  return parsePersonalization(await callSupabaseRpc<unknown>("get_storefront_personalization"));
}

export async function fetchAdminStorefrontPersonalization() {
  return parsePersonalization(await callSupabaseRpc<unknown>("owner_get_storefront_personalization"));
}

export async function clearAdminStorefrontAsset(slotKey: SiteAssetSlotKey) {
  return parsePersonalization(
    await callSupabaseRpc<unknown>("owner_clear_storefront_personalization", { p_slot_key: slotKey }),
  );
}

export function validateSiteAssetFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Formato não aceito. Use WebP, AVIF, JPEG ou PNG.");
  }
  if (file.size <= 0) throw new Error("A imagem selecionada está vazia.");
  if (file.size > SITE_ASSET_MAX_BYTES) throw new Error("A imagem é maior que 15 MB.");
}

export async function readImageDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Não foi possível ler as dimensões da imagem."));
      image.src = url;
    });
    return dimensions;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadAdminStorefrontAsset(input: {
  slotKey: SiteAssetSlotKey;
  file: File;
}) {
  validateSiteAssetFile(input.file);
  const dimensions = await readImageDimensions(input.file);

  const { data: presign, error: presignError } = await supabase.functions.invoke<PresignResponse>(
    "site-asset-presign",
    {
      body: {
        slotKey: input.slotKey,
        contentType: input.file.type.toLowerCase(),
        originalFilename: input.file.name,
        byteSize: input.file.size,
      },
    },
  );

  if (presignError || !presign?.uploadId || !presign.uploadUrl) {
    throw new Error(getUserFacingError(presignError, "Não foi possível preparar o envio da imagem."));
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.requiredHeaders,
    body: input.file,
  });

  if (!uploadResponse.ok) throw new Error("Não foi possível enviar a imagem agora.");

  const { data: completed, error: completeError } = await supabase.functions.invoke<CompleteResponse>(
    "site-asset-complete",
    {
      body: {
        uploadId: presign.uploadId,
        widthPx: dimensions.width,
        heightPx: dimensions.height,
      },
    },
  );

  if (completeError || !completed?.asset?.storageKey) {
    throw new Error(getUserFacingError(completeError, "A imagem foi enviada, mas não foi possível ativá-la."));
  }

  return {
    ...completed.asset,
    url: buildR2PublicImageUrl(completed.asset.storageKey),
  };
}
