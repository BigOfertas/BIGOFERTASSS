import { createFileRoute } from "@tanstack/react-router";

import { handleShippingQuoteRequest } from "@/lib/shipping-server";
import type { ShippingEnvironment } from "@/lib/shipping-server";

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
    return process.env?.["SUPERFRETE_TOKEN"];
  }

  return undefined;
}

function getShippingEnvironment(context: unknown): ShippingEnvironment {
  const token = getSuperFreteToken(context);
  return token ? { SUPERFRETE_TOKEN: token } : {};
}

export const Route = createFileRoute("/api/shipping/quote")({
  server: {
    handlers: {
      GET: async ({ request, context }) =>
        handleShippingQuoteRequest(request, getShippingEnvironment(context), {
          source: "tanstack-route",
        }),
      POST: async ({ request, context }) =>
        handleShippingQuoteRequest(request, getShippingEnvironment(context), {
          source: "tanstack-route",
        }),
    },
  },
});
