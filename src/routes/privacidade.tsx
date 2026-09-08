import { createFileRoute } from "@tanstack/react-router";

import { InstitutionalPage, InstitutionalSection } from "@/components/content/InstitutionalPage";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/privacidade")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <InstitutionalPage
      title="Política de Privacidade"
      description={`Entenda de forma simples como a ${BRAND.officialName} usa os dados necessários para manter sua conta e atender seus pedidos.`}
    >
      <InstitutionalSection title="Quais dados usamos">
        <p>
          Podemos tratar dados de cadastro, contato, endereço, identificação do comprador e
          informações necessárias para pedidos, pagamentos, entrega e atendimento.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Para que usamos">
        <p>
          Os dados são usados para criar e proteger sua conta, processar compras, calcular e
          realizar entregas, enviar comunicações sobre o pedido, prestar suporte e cumprir
          obrigações aplicáveis à operação da loja.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Serviços necessários à compra">
        <p>
          Alguns dados podem ser enviados aos serviços que tornam a compra possível, como
          processamento de pagamento, cálculo e transporte do pedido, infraestrutura de dados e
          envio de comunicações. Compartilhamos somente o necessário para a finalidade
          correspondente.
        </p>
      </InstitutionalSection>
      <InstitutionalSection title="Seus dados e contato">
        <p>
          Você pode revisar dados da sua conta nas áreas disponíveis do site e falar conosco quando
          precisar corrigir informações ou tirar dúvidas sobre privacidade.
        </p>
        <p>
          E-mail:{" "}
          <a
            className="font-bold text-red-600 hover:underline"
            href={`mailto:${BRAND.contactEmail}`}
          >
            {BRAND.contactEmail}
          </a>
        </p>
      </InstitutionalSection>
    </InstitutionalPage>
  );
}
