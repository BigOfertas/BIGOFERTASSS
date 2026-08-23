/**
 * PROMPT PARA LOVABLE — ETAPA 15B (PARTE 2)
 * Atualizar FAQ: Remover Pergunta 1 + Atualizar Todas as Respostas
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * O componente FAQ.tsx foi criado com 13 perguntas, mas precisam de atualizações:
 * 
 * 1. REMOVER: Pergunta 1 (📣 Como funciona a promoção Recompra Garantida?)
 * 2. ATUALIZAR: Todas as respostas (nova formatação fornecida)
 * 
 * Resultado: 12 perguntas com respostas atualizadas
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * 1. Remover a pergunta 1 (Recompra Garantida)
 * 2. Atualizar TODAS as 12 respostas restantes com texto novo
 * 3. Renumerar perguntas (de 1-12)
 * 4. Manter: Structure, animações, estilos, responsividade
 * 
 * ================================================================================
 * 
 * MUDANÇA ESPECÍFICA: ARQUIVO FAQ.tsx
 * 
 * Arquivo: src/components/home/FAQ.tsx
 * 
 * REMOVER COMPLETAMENTE:
 * 
 * ID 1:
 * - Emoji: 📣
 * - Question: "Como funciona a promoção Recompra Garantida?"
 * - Answer: "[PLACEHOLDER]"
 * 
 * MANTER (renumerar de 1 a 12):
 * 
 * Nova pergunta 1 (era 2):
 * ID: 1 (RENUMERAR)
 * Emoji: ✅
 * Question: Quais formas de pagamento vocês aceitam?
 * Answer: Aceitamos pagamentos via pix, cartão de crédito e débito, e boleto.
 * 
 * Nova pergunta 2 (era 3):
 * ID: 2 (RENUMERAR)
 * Emoji: ⏳
 * Question: Qual o prazo para envio e entrega?
 * Answer: Após a confirmação do pagamento, o pedido entra em processo de separação.
 * Separação e entrega: 5 dias úteis para a separação após a confirmação do pagamento e 15 a 25 dias úteis para a entrega, podendo variar conforme a localização do cliente e as condições de envio.
 * 
 * Os prazos informados têm como base a média de entrega dos pedidos anteriores e podem variar conforme fatores externos.
 * 
 * Nova pergunta 3 (era 4):
 * ID: 3 (RENUMERAR)
 * Emoji: 📏
 * Question: Como escolher o tamanho certo?
 * Answer: Disponibilizamos uma tabela de medidas na página de cada produto para ajudar na escolha do tamanho ideal.
 * Em caso de dúvidas, nossa equipe pode auxiliar antes da compra.
 * 
 * Nova pergunta 4 (era 5):
 * ID: 4 (RENUMERAR)
 * Emoji: 🎨
 * Question: Posso personalizar minha camisa?
 * Answer: Sim. Alguns produtos permitem personalização, como nome e número.
 * Recomendamos revisar todas as informações antes de finalizar a compra, pois produtos personalizados seguem regras específicas de cancelamento, conforme nossos Termos e Condições.
 * 
 * Nova pergunta 5 (era 6):
 * ID: 5 (RENUMERAR)
 * Emoji: 💰
 * Question: Preciso pagar alguma taxa de importação?
 */
import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";
import BestSellers from "@/components/home/BestSellers";
import VisualCategories from "@/components/home/VisualCategories";
import BrazilianProducts from "@/components/home/BrazilianProducts";
import BrazilianTeams from "@/components/home/BrazilianTeams";
import ShopByLeague from "@/components/home/ShopByLeague";
import FAQ from "@/components/home/FAQ";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* 1. ARTE PROMOCIONAL SUPERIOR - CARROSSEL CONTÍNUO (1920x100) */}
      <PromoBanner 
        id="superior" 
        style={{ aspectRatio: '1920/100' }}
        className="max-h-[100px] max-md:!aspect-[1920/300] max-md:max-h-none"
        images={[
          "", // Slot 1
          "", // Slot 2
          "", // Slot 3
        ]}
      />

      {/* 2. HEADER PRINCIPAL (Includes CategoryNav in desktop) */}
      <Header />

      {/* 3. ARTE PROMOCIONAL INFERIOR - BANNER GRANDE (1920x550) */}
      <PromoBanner 
        id="inferior" 
        style={{ aspectRatio: '1920/550' }}
        className="min-h-[200px] md:min-h-[400px] max-md:!aspect-[1920/1897] max-md:min-h-none"
      />

      {/* 4. SEÇÃO MAIS VENDIDOS */}
      <main className="flex-1 pb-12">
        <BestSellers />
        <VisualCategories />
        
        {/* BANNER BRASILEIRÃO - SLOT CLICÁVEL */}
        <section className="mt-8 sm:mt-12">
          <div className="container mx-auto px-4">
            <PromoBanner 
              id="Brasileirão" 
              style={{ aspectRatio: '1920/500' }}
              className="rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-shadow max-md:!aspect-[1920/750]"
              href="#" // Deixado preparado para receber o link futuramente
            />
          </div>
        </section>

        {/* 5. TIMES BRASILEIROS */}
        <BrazilianTeams />

        {/* 6. PRODUTOS DO BRASILEIRÃO */}
        <div className="mt-4 sm:mt-8">
          <BrazilianProducts />
        </div>

        {/* 7. COMPRE POR LIGA */}
        <ShopByLeague />
        <FAQ />
      </main>
    </div>
  );
}