import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart, User, X } from "lucide-react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/config/brand";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/lib/auth";
import CategoryNav from "./CategoryNav";

const Header: React.FC = () => {
  const { totalItems } = useCart();
  const { user, isOwner } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const accountDestination = isOwner ? "/admin" : user ? "/conta" : "/login";
  const accountTopLabel = isOwner ? "Painel" : user ? "Minha" : "Acessar";
  const accountBottomLabel = isOwner ? "Admin" : "Conta";

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();

    void navigate({
      to: "/products",
      search: query ? { q: query } : {},
    });

    setMobileMenuOpen(false);
  };

  return (
    <header className="glass-header sticky top-0 z-50">
      <div className="hidden md:block">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8 lg:py-5">
          <div className="flex items-center justify-between gap-10">
            <Link
              to="/"
              className="flex w-56 flex-shrink-0 items-center"
              aria-label={`${BRAND.officialName} - Início`}
            >
              <div className="brand-lockup h-14 w-full px-5 text-2xl">
                <BrandWordmark />
              </div>
            </Link>

            <div className="relative max-w-2xl flex-1">
              <form onSubmit={handleSearch} className="relative group" role="search">
                <Input
                  type="search"
                  aria-label="Buscar produtos"
                  placeholder="O que você está procurando?"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="glass-input h-12 w-full rounded-2xl border-0 pl-5 pr-14 text-sm placeholder:text-gray-400 focus:border-red-600 focus:ring-0 focus-visible:ring-2 focus-visible:ring-red-100"
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="absolute right-1.5 top-1.5 flex h-9 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors group-focus-within:bg-white/70 group-focus-within:text-red-600"
                >
                  <Search className="h-5 w-5" />
                </button>
              </form>
            </div>

            <div className="flex items-center gap-3">
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
                aria-label={`Carrinho com ${totalItems} item(ns)`}
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

      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
            className="header-action -ml-1 h-10 w-10 text-gray-900 active:text-red-600"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>

          <Link
            to="/"
            className="flex flex-1 justify-center px-3"
            aria-label={`${BRAND.officialName} - Início`}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="brand-lockup h-10 w-36 px-3 text-lg">
              <BrandWordmark />
            </div>
          </Link>

          <div className="-mr-1 flex items-center gap-2">
            <Link
              to={accountDestination}
              aria-label={isOwner ? "Abrir painel administrativo" : user ? "Abrir conta" : "Acessar conta"}
              className="header-action h-10 w-10 text-gray-900 active:text-red-600"
            >
              <User className="h-5.5 w-5.5" />
            </Link>
            <Link
              to="/cart"
              aria-label={`Carrinho com ${totalItems} item(ns)`}
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
          <form onSubmit={handleSearch} className="relative group" role="search">
            <Input
              type="search"
              aria-label="Buscar produtos"
              placeholder="O que você está procurando?"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="glass-input h-11 w-full rounded-2xl border-0 pl-4 pr-12 text-sm focus:border-red-600 focus:ring-0 focus-visible:ring-2 focus-visible:ring-red-100"
            />
            <button
              type="submit"
              aria-label="Buscar"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-600"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>

        {mobileMenuOpen ? (
          <CategoryNav mobile onNavigate={() => setMobileMenuOpen(false)} />
        ) : null}
      </div>
    </header>
  );
};

export default Header;
