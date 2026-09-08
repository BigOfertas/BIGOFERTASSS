import { createFileRoute } from "@tanstack/react-router";

import { InstitutionalPage, InstitutionalSection } from "@/components/content/InstitutionalPage";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/trocas-e-devolucoes")({ component: ExchangesPage });

function ExchangesPage() {
  return (
    <InstitutionalPage
      title="Trocas, devoluções e reembolsos"
      description="Veja como pedir atendimento quando houver problema com a peça, necessidade de troca, devolução ou reembolso."
    >
      <InstitutionalSection title="Como solicitar">
        <p>Entre em contato pelos canais oficiais informando o número do pedido e o motivo da solicitação. Quando necessário, nossa equipe poderá pedir fotos da peça e da embalagem para entender o caso.</p>
      </InstitutionalSection>
      <InstitutionalSection title="Condição do produto">
        <p>Até a conclusão da análise, preserve a peça, etiquetas, acessórios e embalagem recebida. Evite uso, lavagem ou alterações que dificultem a avaliação.</p>
      </InstitutionalSection>
      <InstitutionalSection title="Produtos personalizados">
        <p>Itens com nome, número, frase, patch ou outra personalização precisam de análise específica, porque foram produzidos conforme a escolha feita no pedido. Isso não elimina direitos aplicáveis em caso de defeito, erro de produção ou outra situação protegida pela legislação.</p>
      </InstitutionalSection>
      <InstitutionalSection title="Reembolso">
        <p>Quando um reembolso for aprovado, o andamento ficará registrado no pedido e será processado conforme o meio de pagamento utilizado e as regras aplicáveis ao caso.</p>
        <p>Atendimento: <a className="font-bold text-red-600 hover:underline" href={BRAND.whatsappUrl} target="_blank" rel="noreferrer">{BRAND.whatsappDisplay}</a></p>
      </InstitutionalSection>
    </InstitutionalPage>
  );
}
