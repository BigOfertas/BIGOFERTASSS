/**
 * # ETAPA 6 — Criar Banner Clicável do Brasileirão
 * 
 * Considere o **estado ATUAL do projeto BIGofertas** como fonte de verdade.
 * 
 * Faça SOMENTE a criação da área destinada à **arte/banner do Brasileirão** na Home.
 * 
 * A posição correta será:
 * 
 * **Mais Vendidos / Lançamentos**
 * ↓
 * **Diversifique seu pedido / Categorias**
 * ↓
 * **BANNER BRASILEIRÃO**
 * ↓
 * **futura seção Times Brasileiros**
 * 
 * Não criar ainda a seção Times Brasileiros.
 * 
 * ---
 * 
 * ## OBJETIVO
 * 
 * Criar um espaço específico para uma futura **arte PNG/WebP clicável do Brasileirão**.
 * 
 * Essa arte será fornecida posteriormente.
 * 
 * Por enquanto, utilizar somente um placeholder neutro indicando:
 * 
 * **PNG Slot: Brasileirão**
 * 
 * Não gerar nenhuma imagem.
 * 
 * Não criar arte fictícia.
 * 
 * ---
 * 
 * ## BANNER INTEIRO CLICÁVEL
 * 
 * O banner completo deve ser preparado para funcionar como um único link.
 * 
 * Futuramente, ao clicar na arte, o usuário deverá ser direcionado para a área/categoria:
 * 
 * **Brasileirão**
 * 
 * Estrutura conceitual:
 * 
 * ```tsx
 * <PromoBanner
 *   image="..."
 *   href="/brasileirao"
 * />
 * ```
 * 
 * ou solução equivalente compatível com a arquitetura atual.
 * 
 * Se a rota definitiva ainda não existir, não criar lógica complexa nem link quebrado apenas para simular.
 * 
 * Deixar preparado para receber o `href` futuramente.
 * 
 * ---
 * 
 * ## POSICIONAMENTO
 * 
 * O banner deve aparecer imediatamente DEPOIS da seção:
 * 
 * **Diversifique seu pedido**
 * 
 * e ANTES da futura seção:
 * 
 * **Times Brasileiros**
 * 
 * Manter espaçamento profissional entre as seções.
 * 
 * Não deixar um espaço vazio exagerado.
 * 
 * ---
 * 
 * ## DESKTOP
 * 
 * No desktop:
 * 
 * * banner horizontal;
 * * centralizado;
 * * alinhado ao container principal da Home;
 * * largura semelhante às grandes artes promocionais da referência;
 * * não ultrapassar a largura útil do conteúdo;
 * * não ficar excessivamente alto;
 * * aparência de banner profissional de e-commerce.
 * 
 * Não alterar nenhuma seção anterior para acomodar o banner.
 * 
 * ---
 * 
 * ## MOBILE
 * 
 * No mobile:
 * 
 * * continuar horizontal;
 * * ocupar praticamente toda a largura disponível;
 * * manter margens laterais coerentes com o restante da Home;
 * * não ficar exageradamente alto;
 * * adaptar responsivamente;
 * * não criar overflow horizontal.
 * 
 * A futura imagem deve preencher o container sem deformação.
 * 
 * ---
 * 
 * ## IMAGEM FUTURA
 * 
 * Quando a arte real for inserida, preservar:
 * 
 * * `width: 100%`;
 * * proporção da arte;
 * * boa resolução;
 * * ausência de deformação.
 * 
 * Preferir:
 * 
 * * `object-cover` quando necessário para preencher o espaço;
 * 
 * ou outra solução já utilizada pelo projeto que preserve corretamente a imagem.
 * 
 * Não usar `object-fill`.
 * 
 * ---
 * 
 * ## CONTEÚDO TEMPORÁRIO
 * 
 * Neste momento mostrar apenas algo discreto como:
 * 
 * **PNG Slot: Brasileirão**
 * 
 * O placeholder é apenas estrutural.
 * 
 * Não adicionar:
 * 
 * * jogadores fictícios;
 * * escudos;
 * * textos promocionais inventados;
 * * logos;
 * * imagens externas;
 * * gradientes chamativos;
 * * elementos gerados por IA.
 * 
 * A arte definitiva será fornecida depois.
 * 
 * ---
 * 
 * ## COMPONENTIZAÇÃO
 * 
 * Antes de criar um novo componente, verificar se o projeto já possui:
 * 
 * `PromoBanner.tsx`
 * 
 * ou componente equivalente.
 * 
 * Se for adequado, reutilizá-lo.
 * 
 * Não duplicar componente apenas para este banner se a estrutura existente já atende à necessidade.
 * 
 * O comportamento deste banner é:
 * 
 * **imagem estática + clicável**
 * 
 * Ele NÃO é carrossel.
 * 
 * ---
 * 
 * ## NÃO IMPLEMENTAR AINDA
 * 
 * Não criar nesta etapa:
 * 
 * * Times Brasileiros;
 * * logos dos clubes;
 * * carrossel de times;
 * * produtos do Brasileirão;
 * * filtros;
 * * página completa do Brasileirão;
 * * integração com R2;
 * * integração de produtos com Supabase.
 * 
 * Essas serão etapas posteriores.
 * 
 * ---
 * 
 * ## NÃO ALTERAR
 * 
 * Não modificar:
 * 
 * * PNG Slot Superior;
 * * carrossel superior;
 * * PNG Slot Inferior;
 * * Header;
 * * busca;
 * * menu;
 * * Mais Vendidos;
 * * Lançamentos;
 * * cards de produtos;
 * * bolinhas de paginação;
 * * Diversifique seu pedido;
 * * tamanho dos cards de categoria;
 * * Supabase;
 * * Auth;
 * * RLS;
 * * migrations;
 * * TanStack Router;
 * * `.lovable`;
 * * rodapé.
 * 
 * Não realizar refatorações extras.
 * 
 * ---
 * 
 * ## VALIDAÇÃO FINAL
 * 
 * Antes de finalizar, confirmar:
 * 
 * 1. Existe um novo slot para a arte do Brasileirão.
 * 2. Ele está imediatamente abaixo de “Diversifique seu pedido”.
 * 3. Ele está preparado para receber uma PNG/WebP real.
 * 4. O banner poderá ser clicável futuramente.
 * 5. Desktop apresenta formato horizontal e profissional.
 * 6. Mobile está responsivo e sem overflow.
 * 7. Placeholder contém apenas “PNG Slot: Brasileirão”.
 * 8. Não foi gerada nenhuma imagem.
 * 9. Não foi criada ainda a seção Times Brasileiros.
 * 10. Todas as seções anteriores permanecem visualmente intactas.
 * 
 * **Faça exclusivamente esta etapa.**
 */
import { createFileRoute } from "@tanstack/react-router";
import PromoBanner from "@/components/layout/PromoBanner";
import Header from "@/components/layout/Header";
import BestSellers from "@/components/home/BestSellers";
import VisualCategories from "@/components/home/VisualCategories";
import BrazilianProducts from "@/components/home/BrazilianProducts";
import BrazilianTeams from "@/components/home/BrazilianTeams";

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
              className="rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-shadow max-md:!aspect-[1920/1125]"
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
      </main>
    </div>
  );
}