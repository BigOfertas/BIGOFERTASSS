import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import glassLegacyCss from "../glass-legacy.css?url";
import { AuthProvider } from "../lib/auth";
import Footer from "../components/layout/Footer";
import { CartProvider } from "../context/CartContext";
import { Toaster } from "@/components/ui/sonner";
import { Component as CursorFollower } from "@/components/ui/cursor-follower";
import { BRAND } from "@/config/brand";
import { reportLovableError } from "../lib/lovable-error-reporting";

const FOOTER_ROUTES = new Set([
  "/",
  "/products",
  "/privacidade",
  "/trocas-e-devolucoes",
  "/termos-de-compra",
  "/producao-e-envio",
  "/contato",
]);

const INITIAL_REFRESH_MIN_MS = 2300;
const INITIAL_QUERY_WAIT_MS = 2600;
const INITIAL_PLACEHOLDER_WAIT_MS = 2200;
const INITIAL_IMAGE_WAIT_MS = 1800;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

async function waitForInitialQueries(queryClient: QueryClient, timeoutMs: number) {
  const deadline = performance.now() + timeoutMs;
  let idleSince: number | null = null;

  while (performance.now() < deadline) {
    if (queryClient.isFetching() === 0) {
      idleSince ??= performance.now();
      if (performance.now() - idleSince >= 180) return;
    } else {
      idleSince = null;
    }
    await sleep(50);
  }
}

async function waitForStorefrontPlaceholders(timeoutMs: number) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (!document.querySelector("[data-product-card-placeholder]")) return;
    await sleep(50);
  }
}

async function preloadRenderedImages(timeoutMs: number) {
  const sources = Array.from(document.images)
    .map((image) => image.currentSrc || image.src)
    .filter((source): source is string => Boolean(source));
  const uniqueSources = [...new Set(sources)];
  if (uniqueSources.length === 0) return;

  const preload = Promise.allSettled(
    uniqueSources.map(
      (source) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = source;
          if (image.complete) resolve();
        }),
    ),
  );

  await Promise.race([preload, sleep(timeoutMs)]);
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel max-w-md rounded-[1.5rem] p-8 text-center">
        <h1 className="display-title text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="premium-action inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel max-w-md rounded-[1.5rem] p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro ao carregar esta página. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="premium-action inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold"
          >
            Tentar novamente
          </button>
          <Link
            to="/"
            className="glass-card inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-foreground"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: BRAND.storeTitle },
      { name: "description", content: BRAND.storeDescription },
      { name: "author", content: BRAND.officialName },
      { property: "og:title", content: BRAND.storeTitle },
      { property: "og:description", content: BRAND.storeDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: glassLegacyCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [initialRefreshLoading, setInitialRefreshLoading] = useState(true);
  const showStorefrontFooter = FOOTER_ROUTES.has(pathname) || pathname.startsWith("/product/");

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.dataset.initialRefreshLoading = "true";

    const finishInitialLoading = async () => {
      await sleep(150);
      await Promise.all([
        waitForInitialQueries(queryClient, INITIAL_QUERY_WAIT_MS),
        document.fonts?.ready ?? Promise.resolve(),
      ]);
      await waitForStorefrontPlaceholders(INITIAL_PLACEHOLDER_WAIT_MS);
      await preloadRenderedImages(INITIAL_IMAGE_WAIT_MS);

      const remaining = INITIAL_REFRESH_MIN_MS - (performance.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      if (cancelled) return;

      setInitialRefreshLoading(false);
      delete document.documentElement.dataset.initialRefreshLoading;
      document.documentElement.style.overflow = previousOverflow;
    };

    void finishInitialLoading();

    return () => {
      cancelled = true;
      delete document.documentElement.dataset.initialRefreshLoading;
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <div className="relative min-h-screen overflow-x-clip">
            <div
              aria-hidden={initialRefreshLoading ? true : undefined}
              className={`flex min-h-screen flex-col transition-[filter,transform] duration-200 ease-out ${
                initialRefreshLoading
                  ? "pointer-events-none select-none scale-[1.01] blur-[22px]"
                  : "scale-100 blur-0"
              }`}
            >
              <div className="min-h-0 flex-1">
                <Outlet />
              </div>
              {!initialRefreshLoading && showStorefrontFooter ? <Footer /> : null}
            </div>

            {initialRefreshLoading ? (
              <div
                data-initial-refresh-loader
                role="status"
                aria-label="Carregando"
                className="fixed inset-0 z-[9999] flex cursor-none items-center justify-center bg-background/30 backdrop-blur-2xl"
              >
                <LoaderCircle
                  aria-hidden="true"
                  className="size-11 animate-spin text-foreground [animation-duration:1.1s]"
                  strokeWidth={1.8}
                />
              </div>
            ) : null}
          </div>
          {!initialRefreshLoading ? <CursorFollower /> : null}
          <Toaster position="top-center" richColors />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
