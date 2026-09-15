import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import glassLegacyCss from "../glass-legacy.css?url";
import sportThemeCss from "../sport-theme.css?url";
import stage6ThemeCss from "../stage6-theme.css?url";
import stage6DarkRouteFixesCss from "../stage6-dark-route-fixes.css?url";
import { AuthProvider } from "../lib/auth";
import Footer from "../components/layout/Footer";
import { CartProvider } from "../context/CartContext";
import { CookieConsent } from "@/components/privacy/CookieConsent";
import { FloatingWhatsAppSupport } from "@/components/support/FloatingWhatsAppSupport";
import { Toaster } from "@/components/ui/sonner";
import { Component as CursorFollower } from "@/components/ui/cursor-follower";
import { BRAND } from "@/config/brand";
import { getR2PublicBaseUrl } from "@/lib/product-images";
import { I18nProvider } from "@/i18n";
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

const INITIAL_BOOT_SPLASH_MS = 2500;
const DEFAULT_OG_IMAGE = `${BRAND.siteUrl}/og-image.jpg`;
const DROPBOX_FAVICON = "/favicon-dropbox-v2.png?v=20260912b";
const DROPBOX_TOUCH_ICON = "/apple-touch-icon-dropbox-v2.png?v=20260912b";

const R2_IMAGE_ORIGIN = (() => {
  const baseUrl = getR2PublicBaseUrl();
  if (!baseUrl) return null;

  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
})();

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
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:title", content: BRAND.storeTitle },
      { property: "og:description", content: BRAND.storeDescription },
      { property: "og:type", content: "website" },
      { property: "og:url", content: BRAND.siteUrl },
      { property: "og:site_name", content: BRAND.officialName },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${BRAND.officialName} - Loja esportiva` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: BRAND.storeTitle },
      { name: "twitter:description", content: BRAND.storeDescription },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE },
    ],
    links: [
      { rel: "preconnect", href: "https://lh3.googleusercontent.com" },
      { rel: "dns-prefetch", href: "https://lh3.googleusercontent.com" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&family=Teko:wght@500..700&display=swap",
      },
      ...(R2_IMAGE_ORIGIN
        ? [
            { rel: "preconnect", href: R2_IMAGE_ORIGIN },
            { rel: "dns-prefetch", href: R2_IMAGE_ORIGIN },
          ]
        : []),
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: glassLegacyCss },
      { rel: "stylesheet", href: sportThemeCss },
      { rel: "stylesheet", href: stage6ThemeCss },
      { rel: "stylesheet", href: stage6DarkRouteFixesCss },
      { rel: "icon", href: DROPBOX_FAVICON, type: "image/png", sizes: "64x64" },
      { rel: "shortcut icon", href: DROPBOX_FAVICON, type: "image/png", sizes: "64x64" },
      { rel: "apple-touch-icon", href: DROPBOX_TOUCH_ICON, sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
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

function InitialBootSplash() {
  return (
    <div
      data-initial-boot-splash
      aria-label="Carregando loja"
      role="status"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "grid",
        placeItems: "center",
        background: "var(--background)",
      }}
    >
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="16" fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <path
          d="M21 5a16 16 0 0 1 16 16"
          fill="none"
          stroke="#e71919"
          strokeWidth="4"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 21 21"
            to="360 21 21"
            dur="0.72s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [storefrontHydrated, setStorefrontHydrated] = useState(false);
  const [initialBootSplashVisible, setInitialBootSplashVisible] = useState(true);
  const showStorefrontFooter = FOOTER_ROUTES.has(pathname) || pathname.startsWith("/product/");

  useEffect(() => {
    setStorefrontHydrated(true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elapsedSinceNavigationStart = performance.now();
    const remainingSplashMs = Math.max(0, INITIAL_BOOT_SPLASH_MS - elapsedSinceNavigationStart);
    const timer = window.setTimeout(() => {
      setInitialBootSplashVisible(false);
      document.body.style.overflow = previousOverflow;
    }, remainingSplashMs);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="dropbox-theme"
      >
        <I18nProvider>
          <AuthProvider>
            <CartProvider>
              <div className="relative flex min-h-screen flex-col overflow-x-clip">
                <div className="min-h-0 flex-1">
                  <Outlet />
                </div>
                {storefrontHydrated && showStorefrontFooter ? <Footer /> : null}
              </div>
              {storefrontHydrated && pathname === "/" ? <FloatingWhatsAppSupport /> : null}
              <CursorFollower />
              <CookieConsent />
              <Toaster position="top-center" richColors />
              {initialBootSplashVisible ? <InitialBootSplash /> : null}
            </CartProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
