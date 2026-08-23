import React, { useState } from 'react';

interface FAQItem {
  id: number;
  emoji: string;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: 1,
    emoji: "📣",
    question: "Como funciona a promoção Recompra Garantida?",
    answer: "[PLACEHOLDER - Resposta será fornecida pelo cliente]"
  },
  {
    id: 2,
    emoji: "✅",
    question: "Quais formas de pagamento vocês aceitam?",
    answer: "Aceitamos pagamentos via Pix, cartões e boleto."
  },
  {
    id: 3,
    emoji: "⏳",
    question: "Qual o prazo para envio e entrega?",
    answer: "Após a confirmação do pagamento, o pedido entra em processo de separação. Separação e entrega: 5 dias úteis para a separação após a confirmação do pagamento e 15 a 25 dias úteis para a entrega, podendo variar conforme a localização do cliente e as condições de envio.\n\nOs prazos informados têm como base a média de entrega dos pedidos anteriores e podem variar conforme fatores externos."
  },
  {
    id: 4,
    emoji: "📏",
    question: "Como escolher o tamanho certo?",
    answer: "Disponibilizamos uma tabela de medidas na página de cada produto para ajudar na escolha do tamanho ideal. Em caso de dúvidas, nossa equipe pode auxiliar antes da compra."
  },
  {
    id: 5,
    emoji: "🎨",
    question: "Posso personalizar minha camisa?",
    answer: "Sim. Alguns produtos permitem personalização, como nome e número. Recomendamos revisar todas as informações antes de finalizar a compra, pois produtos personalizados seguem regras específicas de cancelamento.\n\nPersonalização normal: até 12 letras + número - R$ 25\nPersonalização estendida: até 50 caracteres, sem número - R$ 45"
  },
  {
    id: 6,
    emoji: "💰",
    question: "Preciso pagar alguma taxa de importação?",
    answer: "Caso o rastreamento apresente o status \"Aguardando pagamento\", nossa equipe realizará o pagamento da taxa necessária para que o pedido continue em trânsito, sem custo para o cliente.\n\nSe o pedido for retido na alfândega ou extraviado, o reenvio será realizado por nossa conta, sem cobrança adicional."
  },
  {
    id: 7,
    emoji: "❌",
    question: "Posso cancelar meu pedido após o pagamento?",
    answer: "Após a confirmação do pagamento, o pedido entra imediatamente em processamento. As solicitações de cancelamento são analisadas conforme o estágio do pedido.\n\nEm produtos personalizados, quando a produção já tiver sido iniciada, serão descontados os custos de produção e personalização já realizados."
  },
  {
    id: 8,
    emoji: "📦",
    question: "Como acompanhar meu pedido?",
    answer: "Após o envio, disponibilizamos um código de rastreamento para acompanhamento da entrega.\n\nÉ importante que o cliente acompanhe o rastreamento e esteja disponível para o recebimento.\n\nCaso o pedido seja devolvido ou não entregue por motivos atribuídos ao cliente, como destinatário ausente, endereço incorreto ou não retirada dentro do prazo informado pelos Correios, o reenvio poderá ser realizado mediante pagamento dos custos de nova remessa e reposição, correspondentes a até 50% do valor pago inicialmente."
  },
  {
    id: 9,
    emoji: "🔄",
    question: "Posso trocar ou devolver meu pedido?",
    answer: "Trocas ou devoluções são aceitas exclusivamente nos seguintes casos:\n- Erro no envio do produto (modelo ou tamanho incorreto)\n- Defeito de fabricação\n\nFora dessas situações, não realizamos trocas ou devoluções."
  },
  {
    id: 10,
    emoji: "🛡️",
    question: "Qual é a garantia dos produtos?",
    answer: "O prazo de garantia é de 30 dias após o recebimento do pedido.\n\nA garantia cobre apenas:\n- Defeitos de fabricação\n- Problemas de qualidade\n- Envio de item diferente do solicitado\n\nApós esse prazo, não serão aceitas solicitações de garantia ou devoluções."
  },
  {
    id: 11,
    emoji: "🕘",
    question: "Qual é o horário de atendimento?",
    answer: "Segunda a sexta: 09h às 18h\nSábados: 09h às 13h\n\nMensagens enviadas fora desse horário serão respondidas no próximo dia útil."
  },
  {
    id: 12,
    emoji: "💲",
    question: "Onde posso consultar os preços dos produtos?",
    answer: "Os preços seguem tabela própria, disponível no site.\n[PLACEHOLDER - Regras de desconto progressivo será fornecido pelo cliente]"
  },
  {
    id: 13,
    emoji: "📞",
    question: "Como entrar em contato?",
    answer: "Para dúvidas sobre produtos, prazos de entrega ou qualquer outra questão, falar com a equipe pelo WhatsApp:\n\n+55 84 8134-7639 — Suporte e Pós Venda\n\nHorário: Segunda a sexta 09h-18h | Sábado 09h-13h"
  }
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
    className={`text-red-600 w-5 h-5 flex-shrink-0 transition-transform duration-300 ease-in-out ${
      isOpen ? 'rotate-180' : 'rotate-0'
    }`}
  >
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

export default function FAQ() {
  const [openId, setOpenId] = useState<number | null>(null);

  const toggle = (id: number) => {
    if (openId === id) {
      setOpenId(null);
    } else {
      setOpenId(id);
    }
  };

  return (
    <section className="py-8 md:py-12 lg:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="text-center text-xl md:text-2xl lg:text-3xl font-bold italic uppercase mb-12 text-black">
          PERGUNTAS FREQUENTES
        </h2>
        
        <div className="max-w-2xl mx-auto space-y-3">
          {faqData.map((item) => (
            <div key={item.id} className="border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all duration-200 overflow-hidden">
              <button 
                onClick={() => toggle(item.id)} 
                className="w-full px-4 py-3 md:px-5 md:py-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors duration-200 text-left"
              >
                <span className="flex items-center gap-3 text-left">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="font-semibold text-gray-800 text-sm md:text-base">
                    {item.question}
                  </span>
                </span>
                <ChevronIcon isOpen={openId === item.id} />
              </button>
              
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openId === item.id 
                    ? 'max-h-96 opacity-100' 
                    : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-4 py-3 md:px-5 md:py-4 text-gray-600 text-xs md:text-sm leading-relaxed whitespace-pre-wrap border-t border-gray-100">
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
