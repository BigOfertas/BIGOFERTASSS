import fs from "node:fs";
import path from "node:path";

const envFiles = [".env", ".env.production"];
const GOOGLE_MEDIA_HOST_RE = /(^|\.)(googleusercontent\.com|usercontent\.google\.com|ggpht\.com)$/i;
const RESPONSIVE_WIDTHS = [320, 480, 640, 768];
const CARD_SIZES = "(max-width: 639px) 48vw, (max-width: 1023px) 31vw, 260px";

function loadEnvValue(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();

  for (const file of envFiles) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const match = text.match(new RegExp(`^${name}=([\\s\\S]*?)$`, "m"));
    if (!match) continue;
    const value = match[1].trim().replace(/^['"]|['"]$/g, "");
    if (value) return value;
  }

  return "";
}

function normalizedHttpsUrl(rawValue) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function optimizedGoogleUrl(rawValue, size) {
  const value = normalizedHttpsUrl(rawValue);
  if (!value) return null;

  try {
    const url = new URL(value);
    if (!GOOGLE_MEDIA_HOST_RE.test(url.hostname)) return value;
    const safeSize = Math.min(2400, Math.max(160, Math.round(size)));
    const pathname = url.pathname
      .replace(/=w\d+(?:-h\d+)?[^/?#]*/i, "")
      .replace(/=s\d+[^/?#]*/i, "");
    url.pathname = `${pathname}=w${safeSize}-h${safeSize}-s-no-gm`;
    return url.toString();
  } catch {
    return value;
  }
}

function encodeR2Key(storageKey) {
  return String(storageKey ?? "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function r2Url(baseUrl, storageKey) {
  const base = normalizedHttpsUrl(baseUrl)?.replace(/\/$/, "");
  const key = encodeR2Key(storageKey);
  return base && key ? `${base}/${key}` : null;
}

function buildPreloadMetadata(item, r2BaseUrl) {
  if (!item || typeof item !== "object") return null;

  const r2Card = r2Url(r2BaseUrl, item.image_card_storage_key);
  const r2Thumb = r2Url(r2BaseUrl, item.image_thumb_storage_key);
  if (r2Card) {
    const candidates = [r2Thumb ? `${r2Thumb} 280w` : null, `${r2Card} 760w`].filter(Boolean);
    return {
      href: r2Card,
      srcSet: candidates.length > 1 ? candidates.join(", ") : null,
      sizes: CARD_SIZES,
    };
  }

  const source =
    normalizedHttpsUrl(item.image_external_url) ?? normalizedHttpsUrl(item.fallback_image_url);
  if (!source) return null;

  try {
    const url = new URL(source);
    if (!GOOGLE_MEDIA_HOST_RE.test(url.hostname)) {
      return { href: source, srcSet: null, sizes: CARD_SIZES };
    }
  } catch {
    return null;
  }

  const candidates = RESPONSIVE_WIDTHS.flatMap((width) => {
    const url = optimizedGoogleUrl(source, width);
    return url ? [`${url} ${width}w`] : [];
  });

  return {
    href: optimizedGoogleUrl(source, 768) ?? source,
    srcSet: candidates.join(", "),
    sizes: CARD_SIZES,
  };
}

const supabaseUrl = loadEnvValue("VITE_SUPABASE_URL");
const publishableKey = loadEnvValue("VITE_SUPABASE_PUBLISHABLE_KEY");
const r2BaseUrl = loadEnvValue("VITE_R2_PUBLIC_BASE_URL");

if (!supabaseUrl || !publishableKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY for homepage snapshot.",
  );
  process.exit(2);
}

const response = await fetch(
  `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/storefront_launch_products`,
  {
    method: "POST",
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${publishableKey}`,
      "content-type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(30_000),
  },
);

if (!response.ok) {
  const body = await response.text();
  console.error(`Homepage launch snapshot failed with HTTP ${response.status}.`);
  if (body) console.error(body.slice(0, 1200));
  process.exit(3);
}

const payload = await response.json();
if (!payload || typeof payload !== "object" || !Array.isArray(payload.items)) {
  console.error("Homepage launch snapshot returned an unexpected payload.");
  process.exit(4);
}

if (payload.items.length === 0) {
  console.error(
    "Homepage launch snapshot returned zero products; refusing to publish an empty launch section.",
  );
  process.exit(5);
}

const outputPath = path.join("src", "generated", "home-launches.ts");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `// Generated automatically before the Hostinger build. Do not edit manually.\nexport default ${JSON.stringify(payload, null, 2)} as const;\n`,
  "utf8",
);

const preload = buildPreloadMetadata(payload.items[0], r2BaseUrl);
if (!preload?.href) {
  console.error("The first homepage product does not have a usable image URL for early preload.");
  process.exit(6);
}

const tempDir = path.join(".tmp");
const preloadPath = path.join(tempDir, "home-product-image-preload.json");
fs.mkdirSync(tempDir, { recursive: true });
fs.writeFileSync(preloadPath, `${JSON.stringify(preload, null, 2)}\n`, "utf8");

console.log(
  `HOME_LAUNCH_SNAPSHOT products=${payload.items.length} output=${outputPath} preload=${preloadPath}`,
);
