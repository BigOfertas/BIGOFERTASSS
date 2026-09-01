import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/5584981347939";

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
    <footer className="bg-gray-800 w-full text-white">
      <div className="max-w-7xl mx-auto px-5 py-8 md:px-8 md:py-12 lg:px-10 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          <div className="flex flex-col">
            <div className="h-20 mb-8 flex items-center">
              <Link
                to="/"
                className="w-56 h-14 bg-gray-50/10 border border-dashed border-gray-600 flex items-center justify-center rounded-sm text-gray-400 font-black italic text-2xl tracking-tighter object-contain"
                aria-label="BIGofertas - Início"
              >
                <span className="text-red-600">BIG</span>ofertas
              </Link>
            </div>

            <h3 className="text-sm font-bold uppercase text-white mb-4 tracking-wider">
              Central de Atendimento
            </h3>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              Fale com a BIGofertas pelos canais oficiais abaixo.
            </p>

            <h3 className="text-sm font-bold uppercase text-white mb-4 tracking-wider">
              Contato
            </h3>
            <ul className="list-none space-y-2 text-sm text-gray-300 mb-6">
              <li>
                Email:{" "}
                <a
                  href="mailto:contato@bigofertas.net"
                  className="text-gray-300 hover:text-red-600 transition-colors duration-200"
                >
                  contato@bigofertas.net
                </a>
              </li>
              <li>
                WhatsApp:{" "}
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-300 hover:text-red-600 transition-colors duration-200"
                >
                  +55 (84) 9 8134-7939
                </a>
              </li>
            </ul>
          </div>

          <div className="flex flex-col lg:col-span-1 md:flex-col">
            <button
              type="button"
              onClick={() => toggleAccordion("acessoRapido")}
              className="w-full flex justify-between items-center py-4 px-0 cursor-pointer lg:cursor-default lg:py-0 lg:pb-4 text-left"
              aria-expanded={expandedAccordions.acessoRapido}
            >
              <h3 className="text-sm font-bold uppercase text-white tracking-wider">
                Acesso Rápido
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-300 transition-transform duration-300 lg:hidden ${
                  expandedAccordions.acessoRapido ? "rotate-180" : ""
                }`}
              />
            </button>

            <ul
              className={`list-none space-y-2 text-sm text-gray-300 overflow-hidden transition-all duration-300 lg:!max-h-none lg:!opacity-100 ${
                expandedAccordions.acessoRapido
                  ? "max-h-[500px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <li>
                <Link
                  to="/"
                  className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200"
                >
                  Início
                </Link>
              </li>
              <li>
                <Link
                  to="/products"
                  search={{}}
                  className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200"
                >
                  Produtos
                </Link>
              </li>
              <li>
                <Link
                  to="/cart"
                  className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200"
                >
                  Carrinho
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col lg:col-span-1 md:flex-col">
            <button
              type="button"
              onClick={() => toggleAccordion("minhaConta")}
              className="w-full flex justify-between items-center py-4 px-0 cursor-pointer lg:cursor-default lg:py-0 lg:pb-4 text-left"
              aria-expanded={expandedAccordions.minhaConta}
            >
              <h3 className="text-sm font-bold uppercase text-white tracking-wider">
                Minha Conta
              </h3>
              <ChevronDown
                className={`w-5 h-5 text-gray-300 transition-transform duration-300 lg:hidden ${
                  expandedAccordions.minhaConta ? "rotate-180" : ""
                }`}
              />
            </button>

            <ul
              className={`list-none space-y-2 text-sm text-gray-300 overflow-hidden transition-all duration-300 lg:!max-h-none lg:!opacity-100 ${
                expandedAccordions.minhaConta
                  ? "max-h-[500px] opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <li>
                <Link
                  to="/login"
                  className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200"
                >
                  Entrar
                </Link>
              </li>
              <li>
                <Link
                  to="/cadastro"
                  className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200"
                >
                  Criar conta
                </Link>
              </li>
              <li>
                <Link
                  to="/cart"
                  className="text-gray-300 hover:text-red-600 hover:underline transition-colors duration-200"
                >
                  Meu carrinho
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col">
            <h3 className="text-sm font-bold uppercase text-white mb-6 tracking-wider">
              Fale conosco
            </h3>
            <div className="flex flex-col gap-4 text-sm text-gray-300">
              <a
                href="mailto:contato@bigofertas.net"
                className="flex items-center gap-3 text-gray-300 hover:text-red-600 transition-colors duration-200"
              >
                <Mail className="w-6 h-6" />
                <span>Email</span>
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 text-gray-300 hover:text-red-600 transition-colors duration-200"
              >
                <MessageCircle className="w-6 h-6" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        <hr className="border-t border-gray-700 my-4 md:my-6 lg:my-8" />

        <div className="text-center text-sm text-gray-400 py-4 md:py-4 lg:py-6">
          <p>Copyright © BIGofertas 2026. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
