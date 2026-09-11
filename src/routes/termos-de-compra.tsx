import { createFileRoute } from "@tanstack/react-router";

import { InstitutionalPage, InstitutionalSection } from "@/components/content/InstitutionalPage";
import { BRAND } from "@/config/brand";
import { buildPageHead } from "@/lib/page-seo";

export const Route = createFileRoute("/termos-de-compra")({
  head: () =>
    buildPageHead({
      title: "Termos de Compra",
      description: "Consulte as condições de produtos, preço, pagamento, produção, entrega e alterações de pedidos realizados na DropBox.",
      path: "/termos-de-compra",
    }),
  component: PurchaseTermsPage,
});

function PurchaseTermsPage() {
  return (
    <InstitutionalPage
      title="Termos de compra"
      description={`Estas condições resumem como funcionam os pedidos realizados na ${BRAND.officialName}.`}
    >
      <InstitutionalSection title="Produtos e escolhas">
        <p>
          Confira modelo, tamanho, variação, personalização, patch, quantidade e endereço antes de
          finalizar. As opções disponíveis na página do produto fazem parte do pedido confirmado.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Preço e pagamento">
        <p>
          O valor final é mostrado antes do pagamento e considera os itens, adicionais selecionados,
          descontos aplicáveis e entrega. O pedido segue para processamento após a confirmação do
          pagamento pelo meio disponibilizado no checkout.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Produção e entrega">
        <p>
          Algumas peças possuem período de preparação antes do envio. O site informa a previsão
          total durante a compra, separando preparação e transporte sempre que houver cotação para o
          CEP.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Alterações e atendimento">
        <p>
          Se perceber algum dado incorreto depois de concluir o pedido, entre em contato o quanto
          antes. Uma alteração só poderá ser feita enquanto for operacionalmente possível e sem
          contrariar direitos aplicáveis.
        </p>
      </InstitutionalSection>
    </InstitutionalPage>
  );
}
