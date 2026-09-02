import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const workerEntry = path.join(root, ".output", "server", "index.mjs");
const wranglerConfigPath = path.join(root, ".output", "server", "wrangler.json");

assert.ok(
  fs.existsSync(workerEntry) && fs.existsSync(wranglerConfigPath),
  "Build Cloudflare ausente. Execute `bun run build` antes do validador.",
);

const wranglerConfig = JSON.parse(fs.readFileSync(wranglerConfigPath, "utf8"));
assert.equal(wranglerConfig.main, "index.mjs");
assert.equal(wranglerConfig.assets?.binding, "ASSETS");

const { default: worker } = await import(pathToFileURL(workerEntry).href);
const originalFetch = globalThis.fetch;
const originalToken = process.env.SUPERFRETE_TOKEN;
const productId = "11111111-1111-4111-8111-111111111111";
let upstreamMode = "unused";
const sentSuperFreteBodies = [];

function request(body, env = { SUPERFRETE_TOKEN: "runtime-test-token" }) {
  return worker.fetch(
    new Request("https://staging.example/api/shipping/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
    env,
    { waitUntil() {} },
  );
}

async function expectDiagnostic(responsePromise, status, code) {
  const response = await responsePromise;
  const payload = await response.json();

  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(response.headers.get("x-bigofertas-shipping-handler"), "quote-v2");
  assert.equal(response.headers.get("x-bigofertas-shipping-code"), code);
  assert.equal(payload.code, code);
  assert.equal(typeof payload.diagnosticId, "string");
  assert.ok(!JSON.stringify(payload).includes("runtime-test-token"));
}

try {
  delete process.env.SUPERFRETE_TOKEN;

  await expectDiagnostic(request("{}", {}), 503, "SHIPPING_ENV_MISSING");

  // Regression: Nitro passes bindings through request.runtime.cloudflare.env
  // and calls the SSR service with only the Request object.
  await expectDiagnostic(request("{}"), 400, "SHIPPING_POSTAL_CODE_INVALID");

  await expectDiagnostic(request("{invalid-json"), 400, "SHIPPING_REQUEST_PARSE_ERROR");

  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));

    if (url.pathname === "/rest/v1/products") {
      if (upstreamMode === "supabase-http") {
        return new Response("unavailable", { status: 503 });
      }
      if (upstreamMode === "supabase-parse") {
        return new Response("not-json", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }
      return Response.json([{ id: productId, weight_grams: 300 }]);
    }

    assert.equal(url.href, "https://api.superfrete.com/api/v0/calculator");
    const requestBody = JSON.parse(String(init?.body));
    sentSuperFreteBodies.push(requestBody);
    if (upstreamMode === "superfrete-http") {
      return new Response("unavailable", { status: 503 });
    }
    if (upstreamMode === "superfrete-parse") {
      return new Response("not-json", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }
    if (upstreamMode === "no-services") return Response.json([]);
    if (upstreamMode === "success") {
      return requestBody.from.postal_code === "59655000"
        ? Response.json([
            { id: 1, price: "20.00", delivery_time: 8 },
            { id: 2, price: "30.00", delivery_time: 4 },
          ])
        : Response.json([{ id: 31, price: "40.00", delivery_time: 3 }]);
    }

    throw new Error(`Modo de upstream não tratado: ${upstreamMode}`);
  };

  const validBody = JSON.stringify({
    postalCode: "21310120",
    items: [{ productId, quantity: 1 }],
  });

  upstreamMode = "supabase-http";
  await expectDiagnostic(request(validBody), 502, "SHIPPING_SUPABASE_HTTP_ERROR");

  upstreamMode = "supabase-parse";
  await expectDiagnostic(request(validBody), 502, "SHIPPING_SUPABASE_PARSE_ERROR");

  upstreamMode = "superfrete-http";
  await expectDiagnostic(request(validBody), 502, "SHIPPING_SUPERFRETE_HTTP_ERROR");

  upstreamMode = "superfrete-parse";
  await expectDiagnostic(request(validBody), 502, "SHIPPING_SUPERFRETE_PARSE_ERROR");

  upstreamMode = "no-services";
  await expectDiagnostic(request(validBody), 422, "SHIPPING_NO_SERVICES");

  // Synthetic provider rows validate arithmetic and filtering only. They are
  // confined to this test and can never be returned by the application.
  upstreamMode = "success";
  sentSuperFreteBodies.length = 0;
  const successResponse = await request(
    JSON.stringify({
      postalCode: "21310120",
      items: [{ productId, quantity: 4 }],
    }),
  );
  const successPayload = await successResponse.json();
  assert.equal(successResponse.status, 200);
  assert.equal(successResponse.headers.get("x-bigofertas-shipping-code"), "SHIPPING_OK");
  assert.equal(successPayload.package.packageCount, 2);
  assert.equal(successPayload.package.quotedWeightGramsPerPackage, 1100);
  assert.deepEqual(
    successPayload.quotes.map((quote) => [
      quote.service,
      quote.originPostalCode,
      quote.basePrice,
      quote.additionalFee,
      quote.totalPrice,
    ]),
    [
      ["PAC", "59655000", 40, 10, 50],
      ["SEDEX", "59655000", 60, 10, 70],
      ["Loggi", "59630508", 80, 30, 110],
    ],
  );
  assert.deepEqual(
    sentSuperFreteBodies.map((body) => ({
      origin: body.from.postal_code,
      services: body.services,
      package: body.package,
    })),
    [
      {
        origin: "59655000",
        services: "1,2",
        package: { height: 5, width: 28, length: 40, weight: 1.1 },
      },
      {
        origin: "59630508",
        services: "31",
        package: { height: 5, width: 28, length: 40, weight: 1.1 },
      },
    ],
  );
} finally {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.SUPERFRETE_TOKEN;
  else process.env.SUPERFRETE_TOKEN = originalToken;
}

console.log("PASS - entrypoint Nitro/Cloudflare encaminha bindings ao frete");
console.log("PASS - falhas de env, Supabase, SuperFrete e parse retornam JSON seguro");
console.log("PASS - regras de origem, embalagem, volumes e adicionais permanecem intactas");
