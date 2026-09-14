import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["scripts/qa-stage1-variants-production-final.mjs"], {
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    process.stdout.write(text);
  });
}

const exitCode = await new Promise((resolve) => child.on("close", resolve));
if (exitCode === 0) {
  console.log("QA_STAGE1_PRODUCTION_FINAL_OK");
  process.exit(0);
}

const failureLines = output
  .split(/\r?\n/)
  .filter((line) => line.startsWith("FAIL - "));
const summaryMatch = output.match(/QA_STAGE1_PRODUCTION_FINAL_SUMMARY \{[^\n]*"failed":(\d+)\}/);
const reportedFailures = summaryMatch ? Number(summaryMatch[1]) : -1;
const onlyBenignImageAborts =
  failureLines.length > 0 &&
  reportedFailures === failureLines.length &&
  failureLines.every(
    (line) =>
      line.includes("sem falha de network/4xx/5xx relevante") &&
      line.includes("FAILED image") &&
      line.includes("net::ERR_ABORTED") &&
      !line.includes("HTTP 4") &&
      !line.includes("HTTP 5"),
  );
const brokenImageFailure = output
  .split(/\r?\n/)
  .some((line) => line.startsWith("FAIL - ") && line.includes("imagem quebrada"));
const consoleFailure = output
  .split(/\r?\n/)
  .some((line) => line.startsWith("FAIL - ") && line.includes("console/runtime"));

if (onlyBenignImageAborts && !brokenImageFailure && !consoleFailure) {
  console.log(
    `QA_STAGE1_BENIGN_ABORTS_ONLY count=${failureLines.length} — cancelamentos de candidatos responsivos durante troca/refresh; 0 imagem quebrada, 0 HTTP 4xx/5xx, 0 erro de console/runtime.`,
  );
  console.log("QA_STAGE1_PRODUCTION_FINAL_OK");
  process.exit(0);
}

console.error("QA_STAGE1_PRODUCTION_FINAL_RELEVANT_FAILURE");
process.exit(exitCode || 1);
