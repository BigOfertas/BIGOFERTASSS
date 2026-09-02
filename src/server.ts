import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  handleInfinitePayWebhookRequest,
  handleStartCheckoutRequest,
} from "./lib/infinitepay-server";
import type { InfinitePayEnvironment } from "./lib/infinitepay-server";
import {
  createShippingAdapterErrorResponse,
  handleShippingQuoteRequest,
} from "./lib/shipping-server";

type WorkerEnvironment = InfinitePayEnvironment;

type ServerEntry = {
  fetch: (
    request: Request,
    options?: {
      context?: {
        workerEnv?: WorkerEnvironment;
      };
    },
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function asWorkerEnvironment(value: unknown): WorkerEnvironment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as WorkerEnvironment;
}

export default {
  async fetch(request: Request, env: unknown, _ctx: unknown) {
    let isShippingRequest = false;
    let isCheckoutRequest = false;
    let isInfinitePayWebhook = false;

    try {
      // Nitro's Cloudflare adapter calls this SSR service with `request` only.
      // Runtime bindings can also be preserved on `request.runtime.cloudflare.env`;
      // each server handler resolves both locations defensively.
      const workerEnv = asWorkerEnvironment(env);
      const url = new URL(request.url);
      isShippingRequest = url.pathname === "/api/shipping/quote";
      isCheckoutRequest = url.pathname === "/api/checkout/start";
      isInfinitePayWebhook =
        url.pathname === "/api/payments/infinitepay/webhook";

      if (isShippingRequest) {
        try {
          return await handleShippingQuoteRequest(request, workerEnv, {
            source: "cloudflare-entry",
          });
        } catch (error) {
          return createShippingAdapterErrorResponse(error);
        }
      }

      if (isCheckoutRequest) {
        return await handleStartCheckoutRequest(request, workerEnv);
      }

      if (isInfinitePayWebhook) {
        return await handleInfinitePayWebhookRequest(request, workerEnv);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, {
        context: { workerEnv },
      });
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      if (isShippingRequest) {
        return createShippingAdapterErrorResponse(error);
      }

      if (isCheckoutRequest) {
        console.error(error);
        return new Response(
          JSON.stringify({
            error: "Não foi possível iniciar o pagamento agora.",
            code: "CHECKOUT_ENTRY_ERROR",
          }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }

      if (isInfinitePayWebhook) {
        console.error(error);
        return new Response(
          JSON.stringify({
            success: false,
            message: "Não foi possível processar a notificação.",
          }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          },
        );
      }

      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
