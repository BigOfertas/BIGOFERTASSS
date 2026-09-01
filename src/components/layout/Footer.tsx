import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  ChevronDown,
  LockKeyhole,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";

const WHATSAPP_URL = "https://wa.me/5584981347939";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "SITE SEGURO",
    description: "Conexão HTTPS no ambiente publicado.",
  },
  {
    icon: LockKeyhole,
    title: "CONTA PROTEGIDA",
    description: "Autenticação e regras de acesso por usuário.",
  },
  {
    icon: BadgeCheck,
    title: "CHECKOUT CONTROLADO",
    description: "Pagamento só será ativado após integração e validação.",
  },
] as const;

export default function Footer() {
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
                <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
                  {description}
                </p>
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
              aria-label="BIGofertas - Início"
            >
              <span className="text-red-600">BIG</span>ofertas
            </Link>

            <p className="mt-5 max-w-xs text-sm leading-relaxed text-gray-400">
              Loja esportiva BIGofertas. Atendimento pelos canais oficiais
              exibidos neste site.
            </p>

            <div className="mt-6 space-y-3 text-sm text-gray-300">
              <a
                href="mailto:contato@bigofertas.net"
                className="flex items-center gap-3 transition-colors duration-200 hover:text-red-500"
              >
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>contato@bigofertas.net</span>
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 transition-colors duration-200 hover:text-red-500"
              >
                <MessageCircle className="h-4 w-4 flex-shrink-0" />
                <span>+55 (84) 9 8134-7939</span>
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
                className={`h-5 w-5 text-gray-400 transition-transform duration-300 lg:hidden ${
                  expandedAccordions.acessoRapido ? "rotate-180" : ""
                }`}
              />
            </button>

            <ul
              className={`space-y-3 overflow-hidden text-sm text-gray-400 transition-all duration-300 lg:!max-h-none lg:!opacity-100 ${
                expandedAccordions.acessoRapido
                  ? "max-h-72 opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <li>
                <Link to="/" className="transition-colors hover:text-white">
                  Início
                </Link>
              </li>
              <li>
                <Link
                  to="/products"
                  search={{}}
                  className="transition-colors hover:text-white"
                >
                  Produtos
                </Link>
              </li>
              <li>
                <Link to="/cart" className="transition-colors hover:text-white">
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
                className={`h-5 w-5 text-gray-400 transition-transform duration-300 lg:hidden ${
                  expandedAccordions.minhaConta ? "rotate-180" : ""
                }`}
              />
            </button>

            <ul
              className={`space-y-3 overflow-hidden text-sm text-gray-400 transition-all duration-300 lg:!max-h-none lg:!opacity-100 ${
                expandedAccordions.minhaConta
                  ? "max-h-72 opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <li>
                <Link to="/login" className="transition-colors hover:text-white">
                  Entrar
                </Link>
              </li>
              <li>
                <Link
                  to="/cadastro"
                  className="transition-colors hover:text-white"
                >
                  Criar conta
                </Link>
              </li>
              <li>
                <Link to="/cart" className="transition-colors hover:text-white">
                  Meu carrinho
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="pb-4 text-xs font-black uppercase tracking-[0.14em] text-white">
              Segurança e transparência
            </h3>
            <ul className="space-y-4 text-sm leading-relaxed text-gray-400">
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <span>
                  O site publicado usa conexão HTTPS para proteger o tráfego entre
                  navegador e servidor.
                </span>
              </li>
              <li className="flex gap-3">
                <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <span>
                  A área de conta utiliza autenticação e permissões de acesso no
                  backend.
                </span>
              </li>
              <li className="flex gap-3">
                <BadgeCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <span>
                  O checkout permanece indisponível até a integração de pagamento
                  ser concluída e validada.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <hr className="my-8 border-white/10" />

        <div className="flex flex-col items-center justify-between gap-3 text-center text-xs text-gray-500 md:flex-row md:text-left">
          <p>Copyright © BIGofertas 2026. Todos os direitos reservados.</p>
          <p>Ambiente publicado com conexão HTTPS.</p>
        </div>
      </div>
    </footer>
  );
}
