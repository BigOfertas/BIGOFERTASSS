import fs from "node:fs";
import path from "node:path";

const projectRef = process.env.SUPABASE_PROJECT_ID?.trim();
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!projectRef || !accessToken) {
  console.error("Supabase migration inspection is missing required CI configuration.");
  process.exit(2);
}

const migrationsDir = path.resolve("supabase/migrations");
const local = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /^\d{14}_.+\.sql$/.test(entry.name))
  .map((entry) => ({
    version: entry.name.slice(0, 14),
    name: entry.name.slice(15, -4),
    file: entry.name,
  }))
  .sort((a, b) => a.version.localeCompare(b.version));

const response = await fetch(
  `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/migrations`,
  {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  },
);

if (!response.ok) {
  console.error(`Supabase migration history request failed with HTTP ${response.status}.`);
  process.exit(3);
}

const payload = await response.json();
if (!Array.isArray(payload)) {
  console.error("Supabase migration history returned an unexpected response.");
  process.exit(4);
}

const remote = payload
  .map((item) => ({
    version: typeof item?.version === "string" ? item.version : "",
    name: typeof item?.name === "string" ? item.name : "",
  }))
  .filter((item) => /^\d{14}$/.test(item.version))
  .sort((a, b) => a.version.localeCompare(b.version));

const localVersions = new Set(local.map((item) => item.version));
const remoteVersions = new Set(remote.map((item) => item.version));
const pending = local.filter((item) => !remoteVersions.has(item.version));
const remoteOnly = remote.filter((item) => !localVersions.has(item.version));

console.log(`Local migrations: ${local.length}`);
console.log(`Remote recorded migrations: ${remote.length}`);
console.log(`Local not recorded remotely: ${pending.length}`);
console.log(`Remote not present locally: ${remoteOnly.length}`);

if (pending.length > 0) {
  console.log("\nLOCAL_NOT_REMOTE");
  for (const item of pending) console.log(`${item.version} ${item.name}`);
}

if (remoteOnly.length > 0) {
  console.log("\nREMOTE_NOT_LOCAL");
  for (const item of remoteOnly) console.log(`${item.version} ${item.name || "(unnamed)"}`);
}

const affiliateVersions = new Set([
  "20260904041000",
  "20260904042500",
  "20260904044000",
]);
const affiliatePending = pending.filter((item) => affiliateVersions.has(item.version));
console.log(`\nAffiliate migrations pending remotely: ${affiliatePending.length}`);
for (const item of affiliatePending) console.log(`${item.version} ${item.name}`);

// Inspection is intentionally read-only. Drift is reported instead of repaired.
