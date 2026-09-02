import { createFileRoute } from "@tanstack/react-router";

import { handleShippingQuoteRequest } from "@/lib/shipping-server";

type ShippingRequestContext = {
  workerEnv?: {
    SUPERFRETE_TOKEN?: string;
  };
};

function getSuperFreteToken(context: unknown) {
  const workerEnv = (context as ShippingRequestContext | undefined)?.workerEnv;
  if (workerEnv?.SUPERFRETE_TOKEN) return workerEnv.SUPERFRETE_TOKEN;

  // TanStack Start exposes server env through process.env on supported runtimes.
  // The typeof guard prevents a Cloudflare Worker without the Node process shim
  // from throwing before our JSON error handling can run.
  if (typeof process !== "undefined") {
    return process.env?.SUPERFRETE_TOKEN;
  }

  return undefined;
}

export const Route = createFileRoute("/api/shipping/quote")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          { error: "Método não permitido." },
          {
            status: 405,
            headers: {
              "cache-control": "no-store, max-age=0",
              "x-content-type-options": "nosniff",
            },
          },
        ),
      POST: async ({ request, context }) =>
        handleShippingQuoteRequest(request, {
          SUPERFRETE_TOKEN: getSuperFreteToken(context),
        }),
    },
  },
});
