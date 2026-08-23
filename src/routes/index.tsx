/**
 * PROMPT PARA LOVABLE — ETAPA 16B (PARTE 2)
 * Integrar Imagens dos Escudos - Times Brasileiros (Imagens 4 a 6)
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * Você vai receber as PRÓXIMAS 3 IMAGENS de escudos para integrar na seção
 * "Times Brasileiros" (BrazilianTeams).
 * 
 * Esta é PARTE 2 de 3:
 * - PARTE 1 (COMPLETA): Imagens 1, 2, 3 ✅
 * - PARTE 2 (AGORA): Imagens 4, 5, 6 (próximos 3 escudos)
 * - PARTE 3: Imagens 7, 8, 9, 10, 11 (últimos 5 escudos)
 * 
 * Status atual:
 * - Posições 1-3 já têm imagens reais
 * - Posições 4-11 têm placeholders
 * - Agora vamos preencher posições 4-6
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * Integrar as 3 PRÓXIMAS imagens (4, 5, 6) no carrossel "Times Brasileiros"
 * 
 * Ordem EXATA:
 * - Imagem 1 anexada (PARTE 2) = Posição 4 (4ª esquerda do carrossel)
 * - Imagem 2 anexada (PARTE 2) = Posição 5
 * - Imagem 3 anexada (PARTE 2) = Posição 6
 * 
 * ================================================================================
 * 
 * MUDANÇA ESPECÍFICA: ARQUIVO BrazilianTeams.tsx
 * 
 * Arquivo: src/components/home/BrazilianTeams.tsx
 * 
 * Contexto:
 * Array de teams com 11 itens
 * 
 * Status atual:
 * - Posições 1-3: Imagens reais ✅
 * - Posições 4-11: Placeholders (cinza/vazio)
 * 
 * Integração PARTE 2:
 * Substituir as POSIÇÕES 4, 5, 6 com as 3 imagens anexadas
 * 
 * Estrutura esperada (posições 4-6):
 * 
 * const teams = [
 *   // ... posições 1-3 já têm imagens (não alterar)
 *   {
 *     id: 4,
 *     name: "Time 4",
 *     image: "[IMAGEM 1 ANEXADA PARTE 2 - POSIÇÃO 4]"
 *   },
 *   {
 *     id: 5,
 *     name: "Time 5",
 *     image: "[IMAGEM 2 ANEXADA PARTE 2 - POSIÇÃO 5]"
 *   },
 *   {
 *     id: 6,
 *     name: "Time 6",
 *     image: "[IMAGEM 3 ANEXADA PARTE 2 - POSIÇÃO 6]"
 *   },
 *   // [RESTO DO ARRAY (7-11) MANTÉM COMO PLACEHOLDER - SERÁ PREENCHIDO NA PARTE 3]
 *   {
 *     id: 7,
 *     name: "Time 7",
 *     image: "[PLACEHOLDER - SERÁ PREENCHIDO NA PARTE 3]"
 *   },
 *   // ... items 8-11 continuam com placeholder
 * ];
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
        className="max-h-[550px] max-md:!aspect-[1920/1897] max-md:max-h-none"
        images={[
          "", // Slot 1
        ]}
      />

      <main className="flex-grow overflow-x-hidden">
        {/* Mais Vendidos / Lançamentos */}
        <BestSellers />

        {/* Diversifique seu Pedido (Categorias Visuais) */}
        <VisualCategories />

        {/* BANNER CLICÁVEL BRASILEIRÃO */}
        <PromoBanner 
          id="brasileirao" 
          style={{ aspectRatio: '1920/300' }}
          className="max-h-[300px] max-md:!aspect-[1920/750] max-md:max-h-none"
          href="/brasileirao"
          images={[
            "", // PNG Slot: Brasileirão
          ]}
        />

        {/* TIMES BRASILEIROS */}
        <BrazilianTeams />

        {/* PRODUTOS DO BRASILEIRÃO */}
        <BrazilianProducts />

        {/* COMPRE POR LIGA */}
        <ShopByLeague />

        {/* FAQ */}
        <FAQ />
      </main>

      {/* Footer Placeholder */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400">© 2026 BIGofertas. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
