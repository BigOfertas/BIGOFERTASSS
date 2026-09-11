import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle } from "lucide-react";

import { InstitutionalPage, InstitutionalSection } from "@/components/content/InstitutionalPage";
import { BRAND } from "@/config/brand";

export const Route = createFileRoute("/contato")({ component: ContactPage });

function ContactPage() {
  return (
    <InstitutionalPage
      title="Contato"
      description="Fale com a equipe pelos canais oficiais para dúvidas sobre produtos, pedidos, entrega ou atendimento pós-compra."
    >
      <InstitutionalSection title="Canais oficiais">
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={`mailto:${BRAND.contactEmail}`}
            className="rounded-xl border border-gray-200 p-4 transition hover:border-red-300"
          >
            <Mail className="h-5 w-5 text-red-600" aria-hidden="true" />
            <strong className="mt-3 block text-gray-950">E-mail</strong>
            <span className="mt-1 block text-sm text-gray-600">Enviar e-mail para a DropBox</span>
          </a>
          <a
            href={BRAND.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-gray-200 p-4 transition hover:border-red-300"
          >
            <MessageCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            <strong className="mt-3 block text-gray-950">WhatsApp</strong>
            <span className="mt-1 block text-sm text-gray-600">{BRAND.whatsappDisplay}</span>
          </a>
        </div>
      </InstitutionalSection>
      <InstitutionalSection title="Tenha seu pedido em mãos">
        <p>
          Se o assunto for uma compra já realizada, informe o número do pedido para facilitar a
          localização e o atendimento.
        </p>
      </InstitutionalSection>
    </InstitutionalPage>
  );
}
