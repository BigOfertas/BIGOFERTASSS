import { execFileSync } from "node:child_process";

function required(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const endpoint = required("R2_ENDPOINT");
const bucket = required("R2_BUCKET");
const env = {
  ...process.env,
  AWS_ACCESS_KEY_ID: required("R2_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: required("R2_SECRET_ACCESS_KEY"),
  AWS_DEFAULT_REGION: "auto",
  AWS_REGION: "auto",
};

function aws(args) {
  return execFileSync("aws", ["--endpoint-url", endpoint, ...args], {
    encoding: "utf8",
    env,
    maxBuffer: 64 * 1024 * 1024,
  });
}

let deleted = 0;
while (true) {
  const payload = JSON.parse(
    aws(["s3api", "list-objects-v2", "--bucket", bucket, "--max-keys", "1000", "--output", "json"]) || "{}",
  );
  const objects = payload.Contents ?? [];
  if (objects.length === 0) break;
  const deletion = JSON.stringify({
    Objects: objects.map((item) => ({ Key: item.Key })),
    Quiet: true,
  });
  execFileSync(
    "aws",
    ["--endpoint-url", endpoint, "s3api", "delete-objects", "--bucket", bucket, "--delete", deletion],
    { stdio: "inherit", env },
  );
  deleted += objects.length;
}

const remaining = JSON.parse(
  aws(["s3api", "list-objects-v2", "--bucket", bucket, "--max-keys", "1", "--output", "json"]) || "{}",
).Contents ?? [];

if (remaining.length !== 0) throw new Error("R2 bucket is not empty after cleanup.");
console.log(`R2_PURGE_OK deleted=${deleted} remaining=0`);
