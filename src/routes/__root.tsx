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
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import glassLegacyCss from "../glass-legacy.css?url";
import { AuthProvider } from "../lib/auth";
import Footer from "../components/layout/Footer";
import { CartProvider } from "../context/CartContext";
import { Toaster } from "@/components/ui/sonner";
import { BRAND } from "@/config/brand";
import { reportLovableError } from "../lib/lovable-error-reporting";

const FOOTER_ROUTES = new Set([
  "/",
  "/products",
  "/cart",
  "/privacidade",
  "/trocas-e-devolucoes",
  "/termos-de-compra",
  "/producao-e-envio",
  "/contato",
]);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel max-w-md rounded-[1.5rem] p-8 text-center">
        <h1 className="display-title text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe ou foi movida.</p>
        <div className="mt-6"><Link to="/" className="premium-action inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold">Voltar ao início</Link></div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-panel max-w-md rounded-[1.5rem] p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Não foi possível carregar esta página</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ocorreu um erro ao carregar esta página. Tente novamente ou volte ao início.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="premium-action inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold">Tentar novamente</button>
          <Link to="/" className="glass-card inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-foreground">Voltar ao início</Link>
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
  return <html lang="pt-BR"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showStorefrontFooter = FOOTER_ROUTES.has(pathname) || pathname.startsWith("/product/");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <Outlet />
          {showStorefrontFooter ? <Footer /> : null}
          <Toaster position="top-center" richColors />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
