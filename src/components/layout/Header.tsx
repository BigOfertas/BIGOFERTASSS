import React from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BadgePercent,
  MapPin,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  User,
  UserRound,
  X,
} from "lucide-react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Stage6HeaderControls } from "@/components/layout/Stage6HeaderControls";
import { Input } from "@/components/ui/input";
import {
  MobileLiquidMorphMenu,
  type MobileLiquidMorphMenuItem,
} from "@/components/ui/mobile-liquid-morph-menu";
import { BRAND } from "@/config/brand";
import { useCart } from "@/context/CartContext";
import { useCatalogSearchSuggestions } from "@/hooks/useCatalogSearchSuggestions";
import { useI18n } from "@/i18n";
import { translateProductDisplayName, uiCopy } from "@/i18n/ui-copy";
import { useAuth } from "@/lib/auth";
import CategoryNav, { categoryLinks } from "./CategoryNav";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type MobilePanel = "categories" | "account" | null;
type AccountMenuSection = "pedidos" | "enderecos" | "dados" | "afiliados" | "seguranca";

function SearchBox({
  query,
  onQueryChange,
  onSubmit,
  onNavigate,
  mobile = false,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onNavigate: () => void;
  mobile?: boolean;
}) {
  const { locale, translateText } = useI18n();
  const [focused, setFocused] = React.useState(false);
  const suggestionsQuery = useCatalogSearchSuggestions(query);
  const suggestions = suggestionsQuery.data ?? [];
  const showSuggestions = focused && query.trim().length >= 2;

  return (
    <div className="relative">
      <form onSubmit={onSubmit} className="relative group" role="search">
        <Input
          type="search"
          aria-label={translateText("Buscar produtos")}
          placeholder={translateText("Busque por time, camisa, retrô, NBA...")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          className={`glass-input w-full rounded-2xl border-0 text-sm placeholder:text-gray-400 focus:border-red-600 focus:ring-0 focus-visible:ring-2 focus-visible:ring-red-100 ${
            mobile ? "h-11 pl-4 pr-12" : "h-12 pl-5 pr-14"
          }`}
        />
        <button
          type="submit"
          aria-label={translateText("Buscar")}
          className={
            mobile
              ? "absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-600"
              : "absolute right-1.5 top-1.5 flex h-9 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors group-focus-within:bg-white/70 group-focus-within:text-red-600"
          }
        >
          <Search className="h-5 w-5" />
        </button>
      </form>

      {showSuggestions ? (
        <div className="absolute left-0 right-0 top-full z-[70] mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          {suggestionsQuery.isLoading ? (
            <p className="px-4 py-4 text-xs font-semibold text-gray-500">
              {translateText("Buscando produtos...")}
            </p>
          ) : suggestions.length > 0 ? (
            <>
              <div className="max-h-[360px] overflow-y-auto py-1">
                {suggestions.map((product) => {
                  const effectivePrice = product.promotional_price ?? product.price;
                  const localizedName = translateProductDisplayName(locale, product.name);
                  return (
                    <Link
                      key={product.id}
                      to="/product/$id"
                      params={{ id: product.slug || product.id }}
                      onClick={onNavigate}
                      className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-gray-50"
                    >
                      <div className="flex h-14 w-12 flex-none items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                        {product.displayImageUrl ? (
                          <img
                            src={product.displayImageUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            width={96}
                            height={120}
                            className="h-full w-full object-contain p-1"
                          />
                        ) : (
                          <span className="text-[8px] font-black text-red-200">
                            {BRAND.shortMark}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs font-bold leading-4 text-gray-900">
                          {localizedName}
                        </p>
                        {product.time ? (
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-gray-400">
                            {product.time}
                          </p>
                        ) : null}
                      </div>
                      <strong className="flex-none text-xs text-gray-950">
                        {currency.format(effectivePrice)}
                      </strong>
                    </Link>
                  );
                })}
              </div>
              <Link
                to="/products"
                search={{ q: query.trim() }}
                onClick={onNavigate}
                className="flex h-11 items-center justify-center border-t border-gray-100 px-4 text-xs font-black text-red-600 hover:bg-red-50"
              >
                {translateText("Ver todos os resultados")}
              </Link>
            </>
          ) : (
            <div className="px-4 py-4">
              <p className="text-xs font-semibold text-gray-500">
                {translateText("Nenhum produto encontrado agora.")}
              </p>
              <Link
                to="/products"
                search={{ q: query.trim() }}
                onClick={onNavigate}
                className="mt-2 inline-block text-xs font-black text-red-600"
              >
                {translateText("Buscar no catálogo")}
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const Header: React.FC = () => {
  const { totalItems } = useCart();
  const { user, isOwner } = useAuth();
  const { locale, translateText } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const mobileHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mobilePanel, setMobilePanel] = React.useState<MobilePanel>(null);

  const accountDestination = isOwner ? "/admin" : user ? "/conta" : "/login";
  const accountTopLabel = uiCopy(locale, isOwner ? "Painel" : user ? "Minha" : "Acessar");
  const accountBottomLabel = isOwner ? "Admin" : uiCopy(locale, "Conta");

  const closeNavigation = React.useCallback(() => setMobilePanel(null), []);

  React.useEffect(() => {
    if (!mobilePanel) return;

    const handleOutside = (event: PointerEvent) => {
      if (mobileHeaderRef.current && !mobileHeaderRef.current.contains(event.target as Node)) {
        setMobilePanel(null);
      }
    };

    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [mobilePanel]);

  React.useEffect(() => {
    setMobilePanel(null);
  }, [location.pathname]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    void navigate({ to: "/products", search: query ? { q: query } : {} });
    setMobilePanel(null);
  };

  function handleMobileCategory(category: (typeof categoryLinks)[number]) {
    setMobilePanel(null);

    if (category.href === "/") {
      if (location.pathname === "/") {
        const launches = document.getElementById("lancamentos");
        if (launches) {
          launches.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }

      void navigate({ to: "/" });
      return;
    }

    void navigate({
      to: "/products",
      search: category.search ?? {},
    });
  }

  function handleAccountSection(section: AccountMenuSection) {
    setMobilePanel(null);

    if (!user) {
      void navigate({ to: "/login" });
      return;
    }

    if (section === "seguranca") {
      void navigate({ to: "/conta", search: {} });
      window.setTimeout(() => {
        document.getElementById("seguranca")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 180);
      return;
    }

    void navigate({
      to: "/conta",
      search: { secao: section },
    });
  }

  const categoryMenuItems: MobileLiquidMorphMenuItem[] = categoryLinks.map((category) => ({
    label: uiCopy(locale, category.name),
    onClick: () => handleMobileCategory(category),
  }));

  const accountMenuItems: MobileLiquidMorphMenuItem[] = [
    {
      label: translateText("Meus pedidos"),
      icon: Package,
      onClick: () => handleAccountSection("pedidos"),
    },
    {
      label: translateText("Endereços"),
      icon: MapPin,
      onClick: () => handleAccountSection("enderecos"),
    },
    {
      label: translateText("Dados pessoais"),
      icon: UserRound,
      onClick: () => handleAccountSection("dados"),
    },
    {
      label: translateText("Afiliados"),
      icon: BadgePercent,
      onClick: () => handleAccountSection("afiliados"),
    },
    {
      label: translateText("Segurança"),
      icon: ShieldCheck,
      onClick: () => handleAccountSection("seguranca"),
    },
  ];

  const homeLabel = uiCopy(locale, "INÍCIO");
  const cartLabel = translateText(`Carrinho com ${totalItems} item(ns)`);

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="hidden lg:block">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8 lg:py-5">
          <div className="flex items-center justify-between gap-10">
            <Link
              to="/"
              className="flex w-56 flex-shrink-0 items-center"
              aria-label={`${BRAND.officialName} - ${homeLabel}`}
            >
              <div className="brand-lockup h-14 w-full px-5 text-2xl">
                <BrandWordmark />
              </div>
            </Link>

            <div className="max-w-2xl flex-1">
              <SearchBox
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSubmit={handleSearch}
                onNavigate={closeNavigation}
              />
            </div>

            <div className="flex items-center gap-3">
              <Stage6HeaderControls />
              <Link
                to={accountDestination}
                className="header-action group gap-3 px-3 py-2.5 transition-colors"
              >
                <User className="h-6 w-6 text-gray-900 transition-colors group-hover:text-red-600" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                    {accountTopLabel}
                  </span>
                  <span className="text-sm font-extrabold tracking-[-0.02em] text-gray-900 transition-colors group-hover:text-red-600">
                    {accountBottomLabel}
                  </span>
                </div>
              </Link>

              <Link
                to="/cart"
                aria-label={cartLabel}
                className="header-action group relative h-12 w-12 transition-colors"
              >
                <ShoppingCart className="h-6 w-6 text-gray-900 transition-colors group-hover:text-red-600" />
                {totalItems > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[9px] font-black text-white shadow-sm">
                    {totalItems}
                  </span>
                ) : null}
              </Link>
            </div>
          </div>
        </div>
        <CategoryNav />
      </div>

      <div ref={mobileHeaderRef} className="lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() =>
              setMobilePanel((current) => (current === "categories" ? null : "categories"))
            }
            aria-label={translateText(
              mobilePanel === "categories" ? "Fechar menu" : "Abrir menu de categorias",
            )}
            aria-expanded={mobilePanel === "categories"}
            className={`header-action -ml-1 h-10 w-10 transition-colors ${
              mobilePanel === "categories"
                ? "bg-[#202124] text-white ring-1 ring-red-600/20"
                : "text-gray-900"
            }`}
          >
            {mobilePanel === "categories" ? (
              <X className="h-5.5 w-5.5" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>

          <Link
            to="/"
            className="flex flex-1 justify-center px-3"
            aria-label={`${BRAND.officialName} - ${homeLabel}`}
            onClick={closeNavigation}
          >
            <div className="brand-lockup h-10 w-36 px-3 text-lg">
              <BrandWordmark />
            </div>
          </Link>

          <div className="-mr-1 flex items-center gap-2">
            <button
              type="button"
              aria-label={translateText(user ? "Abrir opções da conta" : "Acessar conta")}
              aria-expanded={user ? mobilePanel === "account" : undefined}
              onClick={() => {
                if (!user) {
                  closeNavigation();
                  void navigate({ to: "/login" });
                  return;
                }

                setMobilePanel((current) => (current === "account" ? null : "account"));
              }}
              className={`header-action h-10 w-10 transition-colors ${
                mobilePanel === "account"
                  ? "bg-[#202124] text-white ring-1 ring-red-600/20"
                  : "text-gray-900"
              }`}
            >
              {mobilePanel === "account" ? (
                <X className="h-5 w-5" />
              ) : (
                <User className="h-5.5 w-5.5" />
              )}
            </button>
            <Link
              to="/cart"
              aria-label={cartLabel}
              onClick={closeNavigation}
              className="header-action relative h-10 w-10 text-gray-900 active:text-red-600"
            >
              <ShoppingCart className="h-5.5 w-5.5" />
              {totalItems > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-red-600 px-0.5 text-[8px] font-black text-white">
                  {totalItems}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div className="px-4 pb-3">
          <SearchBox
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSubmit={handleSearch}
            onNavigate={closeNavigation}
            mobile
          />
        </div>

        <div className="border-t border-gray-100 px-4 py-3 dark:border-white/10">
          <Stage6HeaderControls mobile />
        </div>

        <MobileLiquidMorphMenu
          open={mobilePanel === "categories"}
          title={translateText("Todas as categorias")}
          items={categoryMenuItems}
          origin="left"
        />
        <MobileLiquidMorphMenu
          open={mobilePanel === "account"}
          title={translateText("Minha conta")}
          items={accountMenuItems}
          origin="right"
        />
      </div>
    </header>
  );
};

export default Header;
