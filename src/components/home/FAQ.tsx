import React, { useState } from "react";

import { BRAND } from "@/config/brand";

interface FAQItem {
  id: number;
  emoji: string;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: 1,
    emoji: "⏳",
    question: "Qual é o prazo para envio e entrega?",
    answer:
      "A produção leva até 5 dias úteis antes do envio. O prazo de transporte depende do CEP e da modalidade escolhida e é mostrado no carrinho.",
  },
  {
    id: 2,
    emoji: "🚚",
    question: "Quais opções de entrega estão disponíveis?",
    answer:
      "PAC, SEDEX e Loggi podem aparecer conforme a disponibilidade para o seu CEP. Informe o CEP no carrinho para conferir preço e prazo.",
  },
  {
    id: 3,
    emoji: "🏷️",
    question: "Como funciona o desconto progressivo?",
    answer:
      "O desconto é aplicado automaticamente pela quantidade total de peças: 5 peças = 5%; 8 peças = 10% + frete grátis; 15 peças = 15%; 25 peças = 20%; 35 peças ou mais = 30%. O frete continua grátis a partir de 8 peças.",
  },
  {
    id: 4,
    emoji: "📏",
    question: "Como escolher o tamanho certo?",
    answer:
      `Confira as opções disponíveis na página do produto. Se tiver dúvida antes de comprar, fale com a ${BRAND.officialName} pelo WhatsApp.`,
  },
  {
    id: 5,
    emoji: "📦",
    question: "Como acompanho meu pedido?",
    answer:
      "Acesse Minha Conta > Pedidos para acompanhar o status. Quando houver código de rastreio, ele também ficará disponível nos detalhes do pedido.",
  },
  {
    id: 6,
    emoji: "🔄",
    question: "Como solicito um reembolso?",
    answer:
      `Quando a opção estiver disponível para o pedido, você poderá solicitar o reembolso em Minha Conta > Pedidos. A ${BRAND.officialName} entrará em contato para dar continuidade.`,
  },
  {
    id: 7,
    emoji: "💲",
    question: "Onde vejo os preços dos produtos?",
    answer:
      "Os preços e promoções vigentes aparecem diretamente nas páginas dos produtos e no carrinho.",
  },
  {
    id: 8,
    emoji: "📞",
    question: "Como entrar em contato?",
    answer:
      `WhatsApp: ${BRAND.whatsappDisplay}\nE-mail: ${BRAND.contactEmail}`,
  },
];

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`h-5 w-5 flex-shrink-0 transform text-red-600 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
      isOpen ? "rotate-180" : "rotate-0"
    }`}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default function FAQ() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => {
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <section className="bg-white py-8 md:py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="mb-12 text-center text-xl font-bold uppercase italic text-black md:text-2xl lg:text-3xl">
          PERGUNTAS FREQUENTES
        </h2>

        <div className="mx-auto max-w-2xl space-y-3">
          {faqData.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 transition-all duration-200 hover:bg-gray-100 motion-reduce:transition-none"
            >
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-expanded={openId === item.id}
                className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors duration-200 hover:bg-gray-100 motion-reduce:transition-none md:px-5 md:py-4"
              >
                <span className="flex items-center gap-3 text-left">
                  <span className="text-xl" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 md:text-base">
                    {item.question}
                  </span>
                </span>
                <ChevronIcon isOpen={openId === item.id} />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none ${
                  openId === item.id
                    ? "max-h-[24rem] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <div className="whitespace-pre-wrap border-t border-gray-100 px-4 py-3 text-xs leading-relaxed text-gray-600 md:px-5 md:py-4 md:text-sm">
                  {item.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
