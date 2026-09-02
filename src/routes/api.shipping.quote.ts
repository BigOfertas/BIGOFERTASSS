import { createFileRoute } from "@tanstack/react-router";

import { handleShippingQuoteRequest } from "@/lib/shipping-server";

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
      POST: async ({ request }) =>
        handleShippingQuoteRequest(request, {
          SUPERFRETE_TOKEN: process.env.SUPERFRETE_TOKEN,
        }),
    },
  },
});
