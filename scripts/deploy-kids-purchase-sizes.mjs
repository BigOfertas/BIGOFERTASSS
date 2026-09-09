import fs from "node:fs";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const migrationName = "product_purchase_sizes_override_20260909";
const migrationFile = "supabase/migrations/20260909234000_product_purchase_sizes_override.sql";

if (!projectRef || !accessToken) {
  console.error("Kids sizes deployment is missing required CI configuration.");
  process.exit(2);
}

const apiBase = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}`;
const headers = {
  authorization: `Bearer ${accessToken}`,
  accept: "application/json",
  "content-type": "application/json",
};

function migrationSql() {
  return fs
    .readFileSync(migrationFile, "utf8")
    .replace(/^\s*BEGIN;\s*/i, "")
    .replace(/\s*COMMIT;\s*$/i, "")
    .trim();
}

async function request(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}: ${text.slice(0, 2500)}`);
  return text ? JSON.parse(text) : null;
}

const history = await request("/database/migrations");
const applied = Array.isArray(history) && history.some((item) => item?.name === migrationName);
if (!applied) {
  console.log(`Applying ${migrationName}...`);
  await request("/database/migrations", {
    method: "POST",
    body: JSON.stringify({ name: migrationName, query: migrationSql() }),
  });
} else {
  console.log(`Already applied: ${migrationName}.`);
}

const verificationPayload = await request("/database/query/read-only", {
  method: "POST",
  body: JSON.stringify({
    query: `
      select
        exists (
          select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = 'product_purchase_settings'
            and column_name = 'sizes_override'
        ) as sizes_override_column,
        exists (
          select 1 from pg_catalog.pg_trigger t
          join pg_catalog.pg_class c on c.oid = t.tgrelid
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = 'product_purchase_settings'
            and t.tgname = 'set_default_product_purchase_sizes_before_write'
            and not t.tgisinternal
        ) as sizes_trigger,
        exists (
          select 1 from pg_catalog.pg_proc p
          join pg_catalog.pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'get_product_purchase_config'
            and p.prosecdef
        ) as purchase_config_security_definer;
    `,
  }),
});

const verification = Array.isArray(verificationPayload) ? verificationPayload[0] : verificationPayload;
console.log("KIDS_PURCHASE_SIZES_BACKEND_VERIFICATION");
console.log(JSON.stringify(verification, null, 2));
if (
  verification?.sizes_override_column !== true ||
  verification?.sizes_trigger !== true ||
  verification?.purchase_config_security_definer !== true
) {
  throw new Error("Kids purchase sizes backend verification failed.");
}
console.log("KIDS_PURCHASE_SIZES_BACKEND_OK");
