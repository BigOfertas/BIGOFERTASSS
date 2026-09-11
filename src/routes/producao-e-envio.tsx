import { createFileRoute } from "@tanstack/react-router";

import { InstitutionalPage, InstitutionalSection } from "@/components/content/InstitutionalPage";
import { buildPageHead } from "@/lib/page-seo";

export const Route = createFileRoute("/producao-e-envio")({
  head: () =>
    buildPageHead({
      title: "Produção e Envio",
      description: "Entenda os prazos de preparação, transporte, previsão total e acompanhamento dos pedidos da DropBox.",
      path: "/producao-e-envio",
    }),
  component: ShippingInfoPage,
});

function ShippingInfoPage() {
  return (
    <InstitutionalPage
      title="Produção e envio"
      description="Entenda a diferença entre o tempo de preparação da peça e o prazo de transporte até o seu endereço."
    >
      <InstitutionalSection title="Preparação do pedido">
        <p>
          O prazo de preparação começa após a confirmação do pagamento. O tempo vigente é mostrado
          na página do produto e no checkout, para que você veja a informação atual antes de
          comprar.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Transporte">
        <p>
          Depois da preparação, o pedido é enviado pela modalidade selecionada no checkout. O prazo
          de transporte depende do CEP, do serviço escolhido e das condições da transportadora.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Previsão total">
        <p>
          Quando a entrega é calculada, a loja mostra a previsão total somando preparação e
          transporte. Assim, o prazo exibido pela transportadora não é confundido com o tempo
          completo até o recebimento.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Acompanhamento">
        <p>
          Quando o pedido for enviado e houver código ou informação de rastreio disponível, o
          acompanhamento ficará associado ao pedido na área do cliente.
        </p>
      </InstitutionalSection>
    </InstitutionalPage>
  );
}
