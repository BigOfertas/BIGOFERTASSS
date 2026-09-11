import fs from "node:fs";
import path from "node:path";

const envFiles = [".env", ".env.production"];

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

const supabaseUrl = loadEnvValue("VITE_SUPABASE_URL");
const publishableKey = loadEnvValue("VITE_SUPABASE_PUBLISHABLE_KEY");

if (!supabaseUrl || !publishableKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY for homepage snapshot.");
  process.exit(2);
}

const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/storefront_launch_products`, {
  method: "POST",
  headers: {
    apikey: publishableKey,
    authorization: `Bearer ${publishableKey}`,
    "content-type": "application/json",
  },
  body: "{}",
  signal: AbortSignal.timeout(30_000),
});

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
  console.error("Homepage launch snapshot returned zero products; refusing to publish an empty launch section.");
  process.exit(5);
}

const outputPath = path.join("src", "generated", "home-launches.ts");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `// Generated automatically before the Hostinger build. Do not edit manually.\nexport default ${JSON.stringify(payload, null, 2)} as const;\n`,
  "utf8",
);

console.log(`HOME_LAUNCH_SNAPSHOT products=${payload.items.length} output=${outputPath}`);
