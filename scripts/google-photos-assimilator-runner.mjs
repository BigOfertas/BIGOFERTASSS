import fs from 'node:fs';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
let outDir = '.artifacts/google-photos-collector/assimilation';
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--out') outDir = args[i + 1] || outDir;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/google-photos-assimilator.mjs', ...args], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

for (let attempt = 1; attempt <= 3; attempt += 1) {
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(`ASSIMILATION_ATTEMPT ${attempt}/3`);
  const code = await runOnce();
  if (code === 0) {
    console.log(`ASSIMILATION_RETRY_RESULT success attempt=${attempt}`);
    process.exit(0);
  }
  if (attempt < 3) {
    const delay = attempt * 3000;
    console.warn(`ASSIMILATION_RETRY transient failure on attempt=${attempt}; retrying in ${delay}ms`);
    await sleep(delay);
  }
}

console.error('ASSIMILATION_RETRY_RESULT failure attempts=3');
process.exit(1);
