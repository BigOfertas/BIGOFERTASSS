import {
  BadgePercent,
  CheckCircle2,
  Link2,
  Megaphone,
  Share2,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { BRAND } from "@/config/brand";

const capabilityCards = [
  {
    title: "Seu link de afiliado",
    description:
      "Quando o programa for liberado para sua conta, seu link pessoal aparecerá aqui pronto para compartilhar.",
    icon: Link2,
  },
  {
    title: "Comissões",
    description:
      "As vendas atribuídas ao seu link e as respectivas comissões ficarão organizadas nesta área.",
    icon: BadgePercent,
  },
  {
    title: "Saques",
    description:
      "Quando houver saldo disponível, o acompanhamento das solicitações de saque ficará concentrado aqui.",
    icon: WalletCards,
  },
] as const;

export function AffiliateAccountPanel() {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 px-5 py-7 text-white sm:px-7 sm:py-8">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-white/5 blur-3xl" />

          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Programa de afiliados
            </span>

            <h2 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
              Indique produtos e acompanhe tudo pela sua conta
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-300 sm:text-base">
              A área de afiliados da {BRAND.officialName} já está preparada para reunir seu link, vendas indicadas, comissões e saques em um só lugar.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
              <Megaphone className="h-4.5 w-4.5 flex-none" aria-hidden="true" />
              O programa ainda não está disponível para esta conta.
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
          {capabilityCards.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-red-600 shadow-sm ring-1 ring-gray-200">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-sm font-extrabold text-gray-950">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-gray-600">{description}</p>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-400">
                Aguardando ativação
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-black text-gray-950">Como essa área vai funcionar</h3>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Quando o programa for ativado para sua conta, as informações reais aparecerão automaticamente aqui. Nenhum saldo, venda ou comissão é simulado enquanto isso.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
            <Share2 className="h-4.5 w-4.5 text-red-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-gray-950">1. Compartilhe</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Use seu link pessoal para indicar os produtos da loja.
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
            <BadgePercent className="h-4.5 w-4.5 text-red-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-gray-950">2. Acompanhe</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Consulte vendas atribuídas e comissões diretamente na sua conta.
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
            <WalletCards className="h-4.5 w-4.5 text-red-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-gray-950">3. Receba</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Acompanhe saldo disponível e solicitações de saque quando forem liberados.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
