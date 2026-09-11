import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, CreditCard, Mail, MessageCircle, PackageCheck } from "lucide-react";

import { COOKIE_PREFERENCES_EVENT } from "@/components/privacy/CookieConsent";
import { BRAND } from "@/config/brand";
import { useAuth } from "@/lib/auth";

const trustItems = [
  {
    icon: PackageCheck,
    title: "PEDIDO ACOMPANHADO",
    description: "Status e histórico na sua conta.",
  },
  { icon: CreditCard, title: "PAGAMENTO ONLINE", description: "Pix e cartões no checkout." },
  { icon: MessageCircle, title: "ATENDIMENTO", description: "Suporte pelos canais oficiais." },
] as const;

const paymentMethods = [
  { name: "Pix", src: "/assets/payments/pix.svg" },
  { name: "Elo", src: "/assets/payments/elo.svg" },
  { name: "Mastercard", src: "/assets/payments/mastercard.svg" },
  { name: "American Express", src: "/assets/payments/amex.svg" },
  { name: "Visa", src: "/assets/payments/visa.svg" },
  { name: "InfinitePay", src: "/assets/payments/infinitepay.svg" },
] as const;

export default function Footer() {
  const { user, isOwner } = useAuth();
  const [expanded, setExpanded] = useState({ acesso: false, conta: false, ajuda: false });
  const toggle = (key: keyof typeof expanded) =>
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  const accordionClass = (open: boolean) =>
    `space-y-3 overflow-hidden text-sm text-gray-400 transition-all duration-300 motion-reduce:transition-none lg:!max-h-none lg:!opacity-100 ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`;

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
        <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-4 lg:gap-9">
          <div>
            <Link
              to="/"
              className="inline-flex w-fit rounded-xl"
              aria-label={`${BRAND.officialName} - Início`}
            >
              <img
                src="/assets/branding/dropbox-footer.svg"
                alt={BRAND.officialName}
                width={160}
                height={103}
                decoding="async"
                className="block w-40 max-w-full rounded-xl bg-white object-contain"
              />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-gray-400">
              Camisas e artigos esportivos com compra online e atendimento pelos canais oficiais.
            </p>
            <div className="mt-6 space-y-3 text-sm text-gray-300">
              <a
                href={`mailto:${BRAND.contactEmail}`}
                className="flex items-center gap-3 hover:text-red-500"
              >
                <Mail className="h-4 w-4" />
                Fale por e-mail
              </a>
              <a
                href={BRAND.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 hover:text-red-500"
              >
                <MessageCircle className="h-4 w-4" />
                {BRAND.whatsappDisplay}
              </a>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => toggle("acesso")}
              className="flex w-full items-center justify-between py-3 text-left lg:cursor-default lg:py-0 lg:pb-4"
              aria-expanded={expanded.acesso}
            >
              <h3 className="text-xs font-black uppercase tracking-[0.14em]">Acesso rápido</h3>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 lg:hidden ${expanded.acesso ? "rotate-180" : ""}`}
              />
            </button>
            <ul className={accordionClass(expanded.acesso)}>
              <li>
                <Link to="/" className="hover:text-white">
                  Início
                </Link>
              </li>
              <li>
                <Link to="/products" search={{}} className="hover:text-white">
                  Produtos
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-white">
                  Carrinho
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <button
              type="button"
              onClick={() => toggle("conta")}
              className="flex w-full items-center justify-between py-3 text-left lg:cursor-default lg:py-0 lg:pb-4"
              aria-expanded={expanded.conta}
            >
              <h3 className="text-xs font-black uppercase tracking-[0.14em]">Minha conta</h3>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 lg:hidden ${expanded.conta ? "rotate-180" : ""}`}
              />
            </button>
            <ul className={accordionClass(expanded.conta)}>
              {isOwner ? (
                <li>
                  <Link to="/admin" className="hover:text-white">
                    Painel administrativo
                  </Link>
                </li>
              ) : user ? (
                <>
                  <li>
                    <Link to="/conta" className="hover:text-white">
                      Minha conta
                    </Link>
                  </li>
                  <li>
                    <Link to="/conta" search={{ secao: "pedidos" }} className="hover:text-white">
                      Pedidos
                    </Link>
                  </li>
                  <li>
                    <Link to="/conta" search={{ secao: "enderecos" }} className="hover:text-white">
                      Endereços
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/login" className="hover:text-white">
                      Entrar
                    </Link>
                  </li>
                  <li>
                    <Link to="/cadastro" className="hover:text-white">
                      Criar conta
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <button
              type="button"
              onClick={() => toggle("ajuda")}
              className="flex w-full items-center justify-between py-3 text-left lg:cursor-default lg:py-0 lg:pb-4"
              aria-expanded={expanded.ajuda}
            >
              <h3 className="text-xs font-black uppercase tracking-[0.14em]">Ajuda e políticas</h3>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 lg:hidden ${expanded.ajuda ? "rotate-180" : ""}`}
              />
            </button>
            <ul className={accordionClass(expanded.ajuda)}>
              <li>
                <Link to="/trocas-e-devolucoes" className="hover:text-white">
                  Trocas e devoluções
                </Link>
              </li>
              <li>
                <Link to="/producao-e-envio" className="hover:text-white">
                  Produção e envio
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="hover:text-white">
                  Privacidade
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))}
                  className="text-left hover:text-white"
                >
                  Preferências de cookies
                </button>
              </li>
              <li>
                <Link to="/termos-de-compra" className="hover:text-white">
                  Termos de compra
                </Link>
              </li>
              <li>
                <Link to="/contato" className="hover:text-white">
                  Contato
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <section
          className="mt-10 rounded-2xl border border-white/10 bg-[#0f1013] p-5 sm:p-6"
          aria-labelledby="footer-payment-title"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-red-500" aria-hidden="true" />
            <h3
              id="footer-payment-title"
              className="text-xs font-black uppercase tracking-[0.14em]"
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
                key={method.name}
                className="inline-flex h-9 min-w-14 items-center justify-center rounded-lg border border-white/15 bg-white px-2.5 py-1.5"
                title={method.name}
              >
                <img
                  src={method.src}
                  alt={method.name}
                  loading="lazy"
                  decoding="async"
                  className="h-5 w-auto max-w-[86px] object-contain"
                />
              </span>
            ))}
          </div>
        </section>

        <hr className="my-8 border-white/10" />
        <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-gray-500 md:flex-row md:text-left">
          <p>Copyright © {BRAND.officialName} 2026. Todos os direitos reservados.</p>
          <Link to="/contato" className="hover:text-gray-300">
            Precisa de ajuda? Fale conosco.
          </Link>
        </div>
      </div>
    </footer>
  );
}
