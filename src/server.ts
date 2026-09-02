import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  createShippingAdapterErrorResponse,
  handleShippingQuoteRequest,
} from "./lib/shipping-server";
import type { ShippingEnvironment } from "./lib/shipping-server";

type WorkerEnvironment = ShippingEnvironment;

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

    try {
      // Nitro's Cloudflare adapter calls this SSR service with `request` only.
      // It preserves Worker bindings on `request.runtime.cloudflare.env`; the
      // shipping handler reads that location first and uses this argument only
      // for runtimes that call the entrypoint directly with `(request, env)`.
      const workerEnv = asWorkerEnvironment(env);
      const url = new URL(request.url);
      isShippingRequest = url.pathname === "/api/shipping/quote";

      if (isShippingRequest) {
        try {
          return await handleShippingQuoteRequest(request, workerEnv, {
            source: "cloudflare-entry",
          });
        } catch (error) {
          return createShippingAdapterErrorResponse(error);
        }
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

      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
