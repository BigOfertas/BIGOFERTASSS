import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";

const WHATSAPP_URL = "https://wa.me/5584981347939";

export default function Footer() {
  return (
    <footer className="w-full bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <Link
              to="/"
              className="inline-flex text-3xl font-black italic tracking-tighter text-white"
              aria-label="BIGofertas - Início"
            >
              <span className="text-red-600">BIG</span>ofertas
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-gray-400">
              Loja esportiva BIGofertas.
            </p>
          </div>

          <nav aria-label="Navegação do rodapé">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
              Navegação
            </h2>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <Link to="/" className="transition-colors hover:text-red-500">
                  Início
                </Link>
              </li>
              <li>
                <Link
                  to="/products"
                  search={{}}
                  className="transition-colors hover:text-red-500"
                >
                  Produtos
                </Link>
              </li>
              <li>
                <Link
                  to="/cart"
                  className="transition-colors hover:text-red-500"
                >
                  Carrinho
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="transition-colors hover:text-red-500"
                >
                  Entrar
                </Link>
              </li>
              <li>
                <Link
                  to="/cadastro"
                  className="transition-colors hover:text-red-500"
                >
                  Criar conta
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
              Atendimento
            </h2>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <a
                  href="mailto:contato@bigofertas.net"
                  className="transition-colors hover:text-red-500"
                >
                  contato@bigofertas.net
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-red-500"
                >
                  +55 (84) 9 8134-7939
                </a>
              </li>
            </ul>
          </div>
        </div>

        <hr className="my-8 border-gray-800" />

        <p className="text-center text-sm text-gray-500">
          Copyright © BIGofertas 2026. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
