import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  CreditCard,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "SITE SEGURO",
    description: "Navegação protegida por HTTPS.",
  },
  {
    icon: LockKeyhole,
    title: "CONTA PROTEGIDA",
    description: "Acesso seguro à sua conta.",
  },
  {
    icon: MessageCircle,
    title: "ATENDIMENTO",
    description: "Suporte pelos nossos canais oficiais.",
  },
] as const;

const paymentMethods = ["PIX", "VISA", "MASTERCARD", "ELO", "AMEX"] as const;

export default function Footer() {
  const { user, isOwner } = useAuth();
  const [expandedAccordions, setExpandedAccordions] = useState({
    acessoRapido: false,
    minhaConta: false,
  });

  const toggleAccordion = (key: keyof typeof expandedAccordions) => {
    setExpandedAccordions((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  return (
    <footer className="w-full border-t-4 border-red-600 bg-[#15171b] text-white">
      <div className="border-b border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-5 py-5 md:grid-cols-3 md:px-8 lg:px-10">
          {trustItems.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-600/10 text-red-500">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white">
                  {title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-12 lg:px-10 lg:py-14">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          <div className="flex flex-col">
            <Link
              to="/"
              className="inline-flex w-fit items-baseline text-3xl font-black italic tracking-tighter text-white"
              aria-label={`${BRAND.officialName} - Início`}
            >
              <BrandWordmark />
            </Link>

            <p className="mt-5 max-w-xs text-sm leading-relaxed text-gray-400">
              Camisas esportivas com atendimento pelos canais oficiais da {BRAND.officialName}.
            </p>

            <div className="mt-6 space-y-3 text-sm text-gray-300">
              <a
                href={`mailto:${BRAND.contactEmail}`}
                className="flex items-center gap-3 transition-colors duration-200 hover:text-red-500 motion-reduce:transition-none"
              >
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>{BRAND.contactEmail}</span>
              </a>
              <a
                href={BRAND.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 transition-colors duration-200 hover:text-red-500 motion-reduce:transition-none"
              >
                <MessageCircle className="h-4 w-4 flex-shrink-0" />
                <span>{BRAND.whatsappDisplay}</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleAccordion("acessoRapido")}
              className="flex w-full items-center justify-between py-3 text-left lg:cursor-default lg:py-0 lg:pb-4"
              aria-expanded={expandedAccordions.acessoRapido}
            >
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">
                Acesso rápido
              </h3>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform duration-300 motion-reduce:transition-none lg:hidden ${
                  expandedAccordions.acessoRapido ? "rotate-180" : ""
                }`}
              />
            </button>

            <ul
              className={`space-y-3 overflow-hidden text-sm text-gray-400 transition-all duration-300 motion-reduce:transition-none lg:!max-h-none lg:!opacity-100 ${
                expandedAccordions.acessoRapido ? "max-h-72 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <li>
                <Link
                  to="/"
                  className="transition-colors hover:text-white motion-reduce:transition-none"
                >
                  Início
                </Link>
              </li>
              <li>
                <Link
                  to="/products"
                  search={{}}
                  className="transition-colors hover:text-white motion-reduce:transition-none"
                >
                  Produtos
                </Link>
              </li>
              <li>
                <Link
                  to="/cart"
                  className="transition-colors hover:text-white motion-reduce:transition-none"
                >
                  Carrinho
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleAccordion("minhaConta")}
              className="flex w-full items-center justify-between py-3 text-left lg:cursor-default lg:py-0 lg:pb-4"
              aria-expanded={expandedAccordions.minhaConta}
            >
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">
                Minha conta
              </h3>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform duration-300 motion-reduce:transition-none lg:hidden ${
                  expandedAccordions.minhaConta ? "rotate-180" : ""
                }`}
              />
            </button>

            <ul
              className={`space-y-3 overflow-hidden text-sm text-gray-400 transition-all duration-300 motion-reduce:transition-none lg:!max-h-none lg:!opacity-100 ${
                expandedAccordions.minhaConta ? "max-h-72 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              {isOwner ? (
                <li>
                  <Link
                    to="/admin"
                    className="transition-colors hover:text-white motion-reduce:transition-none"
                  >
                    Painel administrativo
                  </Link>
                </li>
              ) : user ? (
                <>
                  <li>
                    <Link
                      to="/conta"
                      className="transition-colors hover:text-white motion-reduce:transition-none"
                    >
                      Minha conta
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/conta"
                      search={{ secao: "enderecos" }}
                      className="transition-colors hover:text-white motion-reduce:transition-none"
                    >
                      Endereços
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/conta"
                      search={{ secao: "pedidos" }}
                      className="transition-colors hover:text-white motion-reduce:transition-none"
                    >
                      Pedidos
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      to="/login"
                      className="transition-colors hover:text-white motion-reduce:transition-none"
                    >
                      Entrar
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/cadastro"
                      className="transition-colors hover:text-white motion-reduce:transition-none"
                    >
                      Criar conta
                    </Link>
                  </li>
                </>
              )}
              <li>
                <Link
                  to="/cart"
                  className="transition-colors hover:text-white motion-reduce:transition-none"
                >
                  Meu carrinho
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="pb-4 text-xs font-black uppercase tracking-[0.14em] text-white">
              Compra segura
            </h3>
            <ul className="space-y-4 text-sm leading-relaxed text-gray-400">
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <span>Navegação protegida por HTTPS.</span>
              </li>
              <li className="flex gap-3">
                <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <span>Acesso protegido à sua conta.</span>
              </li>
              <li className="flex gap-3">
                <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <span>Suporte pelos canais oficiais da {BRAND.officialName}.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 grid gap-4 rounded-2xl border border-white/10 bg-[#0f1013] p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <section aria-labelledby="footer-payment-title">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-red-500" aria-hidden="true" />
              <h3
                id="footer-payment-title"
                className="text-xs font-black uppercase tracking-[0.14em] text-white"
              >
                Formas de pagamento
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              Pix e principais cartões no pagamento online.
            </p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Formas de pagamento">
              {paymentMethods.map((method) => (
                <span
                  key={method}
                  className="inline-flex min-h-9 items-center rounded-lg border border-white/15 bg-white px-3 py-1.5 text-[11px] font-black tracking-wide text-gray-900 shadow-sm"
                >
                  {method}
                </span>
              ))}
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-black tracking-wide text-emerald-300">
                <WalletCards className="h-4 w-4" aria-hidden="true" />
                INFINITEPAY
              </span>
            </div>
          </section>

          <section
            aria-labelledby="footer-security-title"
            className="lg:border-l lg:border-white/10 lg:pl-8"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <h3
                id="footer-security-title"
                className="text-xs font-black uppercase tracking-[0.14em] text-white"
              >
                Site seguro
              </h3>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                HTTPS ativo
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200">
                <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                Acesso protegido
              </span>
            </div>
          </section>
        </div>

        <hr className="my-8 border-white/10" />

        <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-gray-500 md:flex-row md:text-left">
          <p>Copyright © {BRAND.officialName} 2026. Todos os direitos reservados.</p>
          <p>Conexão segura por HTTPS.</p>
        </div>
      </div>
    </footer>
  );
}
