import { HeadObjectCommand, S3Client } from "npm:@aws-sdk/client-s3@3.1121.0";
import { AwsClient } from "npm:aws4fetch@1.0.20";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/webp",
  "image/avif",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const EXTENSION_BY_MIME: Record<AllowedImageMimeType, string> = {
  "image/webp": "webp",
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`${name} nao configurada`);
  }

  return value;
}

function getR2Credentials() {
  return {
    accountId: requiredEnv("R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
  };
}

export function getR2BucketName() {
  return requiredEnv("R2_BUCKET_NAME");
}

export function getR2Client() {
  const { accountId, accessKeyId, secretAccessKey } = getR2Credentials();

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function isAllowedImageMimeType(value: string): value is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

export function buildProductImageObjectKey(
  productId: string,
  variantId: string | null,
  mimeType: AllowedImageMimeType,
) {
  const extension = EXTENSION_BY_MIME[mimeType];
  const imageId = crypto.randomUUID();

  return variantId
    ? `products/${productId}/variants/${variantId}/${imageId}.${extension}`
    : `products/${productId}/${imageId}.${extension}`;
}

export function buildProductImageObjectKeys(productId: string, variantId: string | null) {
  const imageId = crypto.randomUUID();
  const prefix = variantId
    ? `products/${productId}/variants/${variantId}/${imageId}`
    : `products/${productId}/${imageId}`;

  return {
    full: `${prefix}.webp`,
    card: `${prefix}-card.webp`,
    thumb: `${prefix}-thumb.webp`,
  };
}

export function buildSiteAssetObjectKey(slotKey: string, mimeType: AllowedImageMimeType) {
  const extension = EXTENSION_BY_MIME[mimeType];
  const safeSlot = slotKey.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return `site-assets/${safeSlot}/${crypto.randomUUID()}.${extension}`;
}

export function getUploadTtlSeconds() {
  const configured = Number(Deno.env.get("R2_UPLOAD_URL_TTL_SECONDS") ?? "900");

  if (!Number.isFinite(configured)) {
    return 900;
  }

  return Math.max(60, Math.min(3600, Math.trunc(configured)));
}

export function getMaxImageBytes() {
  const configured = Number(Deno.env.get("R2_MAX_IMAGE_BYTES") ?? "15728640");

  if (!Number.isFinite(configured) || configured <= 0) {
    return 15 * 1024 * 1024;
  }

  return Math.trunc(configured);
}

function encodeObjectKey(objectKey: string) {
  return objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function createImageUploadUrl(objectKey: string, contentType: AllowedImageMimeType) {
  const { accountId, accessKeyId, secretAccessKey } = getR2Credentials();
  const bucket = getR2BucketName();
  const expiresIn = getUploadTtlSeconds();
  const r2Url = `https://${accountId}.r2.cloudflarestorage.com`;
  const client = new AwsClient({
    service: "s3",
    region: "auto",
    accessKeyId,
    secretAccessKey,
  });

  const signedRequest = await client.sign(
    new Request(
      `${r2Url}/${encodeURIComponent(bucket)}/${encodeObjectKey(objectKey)}?X-Amz-Expires=${expiresIn}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
      },
    ),
    {
      aws: { signQuery: true },
    },
  );

  return { uploadUrl: signedRequest.url.toString(), expiresIn };
}

export async function headProductImage(objectKey: string) {
  const client = getR2Client();
  const bucket = getR2BucketName();
  const result = await client.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    }),
  );

  return {
    byteSize: result.ContentLength ?? null,
    contentType: result.ContentType?.toLowerCase() ?? null,
    etag: result.ETag?.replace(/^"|"$/g, "") ?? null,
  };
}
