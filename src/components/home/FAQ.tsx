import { memo, useCallback, useEffect, useState } from "react";

import DirectionalReveal from "@/components/ui/directional-reveal";
import SlideUpReveal from "@/components/ui/slide-up-reveal";
import { BRAND } from "@/config/brand";

const FAQ_EXIT_DURATION_MS = 150;

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
    answer: `Confira as opções disponíveis na página do produto. Se tiver dúvida antes de comprar, fale com a ${BRAND.officialName} pelo WhatsApp.`,
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
    answer: `Quando a opção estiver disponível para o pedido, você poderá solicitar o reembolso em Minha Conta > Pedidos. A ${BRAND.officialName} entrará em contato para dar continuidade.`,
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
    answer: `WhatsApp: ${BRAND.whatsappDisplay}\nE-mail: use a página de contato para falar com a ${BRAND.officialName}.`,
  },
  {
    id: 9,
    emoji: "🤝",
    question: `Como faço para ser afiliado da ${BRAND.officialName}?`,
    answer:
      "Crie sua conta, entre em “Minha Conta” e clique em “Quero ser afiliado”. Seu link exclusivo e seu painel serão liberados.",
  },
  {
    id: 10,
    emoji: "💰",
    question: "Quanto ganho como afiliado?",
    answer:
      "Você recebe um valor fixo por peça nas compras dos clientes vinculados à sua indicação. Consulte os valores aplicáveis à sua conta no painel de afiliado.",
  },
  {
    id: 11,
    emoji: "🔗",
    question: "Meu link de afiliado expira?",
    answer:
      "Não. Seu link permanece o mesmo enquanto você for afiliado ativo. Se desativar sua participação, ele deixa de aceitar novas indicações, mas seu histórico permanece.",
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
    className={`h-5 w-5 flex-shrink-0 transform-gpu text-red-600 transition-transform duration-150 ease-out motion-reduce:transition-none ${
      isOpen ? "rotate-180" : "rotate-0"
    }`}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

interface FAQRowProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: (id: number) => void;
}

const FAQRow = memo(function FAQRow({ item, isOpen, onToggle }: FAQRowProps) {
  const answerId = `faq-answer-${item.id}`;
  const [answerMounted, setAnswerMounted] = useState(isOpen);
  const [answerVisible, setAnswerVisible] = useState(false);

  useEffect(() => {
    let frame: number | undefined;
    let timeout: number | undefined;

    if (isOpen) {
      setAnswerMounted(true);
      frame = window.requestAnimationFrame(() => setAnswerVisible(true));
    } else if (answerMounted) {
      setAnswerVisible(false);
      timeout = window.setTimeout(() => setAnswerMounted(false), FAQ_EXIT_DURATION_MS);
    }

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [answerMounted, isOpen]);

  const answerActive = isOpen && answerVisible;

  return (
    <div className="glass-card overflow-hidden rounded-[1.25rem]">
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        aria-expanded={isOpen}
        aria-controls={answerId}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-4 text-left md:px-5 md:py-5"
      >
        <span className="flex items-center gap-3.5 text-left">
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/70 bg-white/75 text-lg shadow-sm"
            aria-hidden="true"
          >
            {item.emoji}
          </span>
          <span className="text-sm font-bold tracking-[-0.02em] text-gray-900 md:text-base">
            {item.question}
          </span>
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {answerMounted ? (
        <div
          id={answerId}
          aria-hidden={!isOpen}
          className={`transform-gpu border-t border-white/70 bg-white/35 transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            answerActive ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          }`}
          style={{ contain: "paint" }}
        >
          <div className="whitespace-pre-wrap px-4 py-4 text-xs leading-relaxed text-gray-600 md:px-5 md:py-5 md:text-sm">
            {item.answer}
          </div>
        </div>
      ) : (
        <div id={answerId} hidden />
      )}
    </div>
  );
});

export default function FAQ() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = useCallback((id: number) => {
    setOpenId((current) => (current === id ? null : id));
  }, []);

  return (
    <section className="bg-transparent py-12 md:py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-8 text-center sm:mb-10">
          <p className="display-kicker">
            <DirectionalReveal direction="up" distance={9}>
              Antes de comprar
            </DirectionalReveal>
          </p>
          <h2 className="display-title-sm mt-2">
            <SlideUpReveal
              split="words"
              stagger={0.065}
              inView
              className="justify-center"
              wordClass="pb-[0.08em]"
            >
              Perguntas frequentes
            </SlideUpReveal>
          </h2>
        </div>

        <div className="mx-auto max-w-3xl space-y-3">
          {faqData.map((item) => (
            <FAQRow key={item.id} item={item} isOpen={openId === item.id} onToggle={toggle} />
          ))}
        </div>
      </div>
    </section>
  );
}
