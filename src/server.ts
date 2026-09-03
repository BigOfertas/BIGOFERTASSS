import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import {
  handlePasswordLoginRequest,
  handleStartEmailTwoFactorEnrollmentRequest,
  handleVerifyEmailTwoFactorEnrollmentRequest,
  handleVerifyPasswordLoginTwoFactorRequest,
} from "./lib/email-2fa-server";
import type { EmailTwoFactorEnvironment } from "./lib/email-2fa-server";
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

type WorkerEnvironment = InfinitePayEnvironment & EmailTwoFactorEnvironment;

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

const DEFAULT_RESEND_FROM = "BIGofertas <contato@bigofertas.net>";

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

function resolveWorkerEnvironment(value: unknown): WorkerEnvironment {
  const processEnvironment =
    typeof process !== "undefined" ? asWorkerEnvironment(process.env) : {};
  const explicitEnvironment = asWorkerEnvironment(value);

  return {
    ...processEnvironment,
    ...explicitEnvironment,
    RESEND_FROM:
      explicitEnvironment.RESEND_FROM ??
      processEnvironment.RESEND_FROM ??
      DEFAULT_RESEND_FROM,
  };
}

function authEntryErrorResponse(error: unknown) {
  console.error(error);
  return new Response(
    JSON.stringify({
      error: "Não foi possível concluir a verificação de segurança agora.",
      code: "EMAIL_2FA_ENTRY_ERROR",
    }),
    {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}

export default {
  async fetch(request: Request, env: unknown, _ctx: unknown) {
    let isShippingRequest = false;
    let isCheckoutRequest = false;
    let isInfinitePayWebhook = false;
    let isAuthSecurityRequest = false;

    try {
      // Cloudflare can expose runtime bindings through the Worker env argument
      // and, with Node compatibility, through process.env. Resolve both paths so
      // a framework adapter cannot make secrets disappear between deployments.
      const workerEnv = resolveWorkerEnvironment(env);
      const url = new URL(request.url);
      isShippingRequest = url.pathname === "/api/shipping/quote";
      isCheckoutRequest = url.pathname === "/api/checkout/start";
      isInfinitePayWebhook =
        url.pathname === "/api/payments/infinitepay/webhook";
      isAuthSecurityRequest = url.pathname.startsWith("/api/auth/");

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

      if (url.pathname === "/api/auth/password-login") {
        return await handlePasswordLoginRequest(request, workerEnv);
      }

      if (url.pathname === "/api/auth/password-login/verify-2fa") {
        return await handleVerifyPasswordLoginTwoFactorRequest(request, workerEnv);
      }

      if (url.pathname === "/api/auth/email-2fa/enroll/start") {
        return await handleStartEmailTwoFactorEnrollmentRequest(request, workerEnv);
      }

      if (url.pathname === "/api/auth/email-2fa/enroll/verify") {
        return await handleVerifyEmailTwoFactorEnrollmentRequest(request, workerEnv);
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

      if (isAuthSecurityRequest) {
        return authEntryErrorResponse(error);
      }

      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
