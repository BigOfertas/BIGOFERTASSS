/**
 * PROMPT PARA LOVABLE — ETAPA 16C (PARTE 3)
 * Integrar Imagens dos Escudos - Times Brasileiros (Imagens 7 a 11)
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * Você vai receber as ÚLTIMAS 5 IMAGENS de escudos para integrar na seção
 * "Times Brasileiros" (BrazilianTeams).
 * 
 * Esta é PARTE 3 (FINAL) de 3:
 * - PARTE 1 (COMPLETA): Imagens 1, 2, 3 ✅
 * - PARTE 2 (COMPLETA): Imagens 4, 5, 6 ✅
 * - PARTE 3 (AGORA): Imagens 7, 8, 9, 10, 11 (últimos 5 escudos)
 * 
 * Status atual:
 * - Posições 1-6 já têm imagens reais
 * - Posições 7-11 têm placeholders
 * - Agora vamos preencher posições 7-11 (FINAL)
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * Integrar as 5 ÚLTIMAS imagens (7, 8, 9, 10, 11) no carrossel
 * 
 * Ordem EXATA:
 * - Imagem 1 anexada (PARTE 3) = Posição 7
 * - Imagem 2 anexada (PARTE 3) = Posição 8
 * - Imagem 3 anexada (PARTE 3) = Posição 9
 * - Imagem 4 anexada (PARTE 3) = Posição 10
 * - Imagem 5 anexada (PARTE 3) = Posição 11 (última à direita)
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
 * - Posições 1-6: Imagens reais ✅
 * - Posições 7-11: Placeholders (cinza/vazio)
 * 
 * Integração PARTE 3 (FINAL):
 * Substituir as POSIÇÕES 7, 8, 9, 10, 11 com as 5 imagens anexadas
 * 
 * Estrutura esperada (posições 7-11):
 * 
 * const teams = [
 *   // ... posições 1-6 já têm imagens (não alterar)
 *   {
 *     id: 7,
 *     name: "Time 7",
 *     image: "[IMAGEM 1 ANEXADA PARTE 3 - POSIÇÃO 7]"
 *   },
 *   {
 *     id: 8,
 *     name: "Time 8",
 *     image: "[IMAGEM 2 ANEXADA PARTE 3 - POSIÇÃO 8]"
 *   },
 *   {
 *     id: 9,
 *     name: "Time 9",
 *     image: "[IMAGEM 3 ANEXADA PARTE 3 - POSIÇÃO 9]"
 *   },
 *   {
 *     id: 10,
 *     name: "Time 10",
 *     image: "[IMAGEM 4 ANEXADA PARTE 3 - POSIÇÃO 10]"
 *   },
 *   {
 *     id: 11,
 *     name: "Time 11",
 *     image: "[IMAGEM 5 ANEXADA PARTE 3 - POSIÇÃO 11]"
 *   }
 * ];
 * 
 * ETAPA 16 COMPLETA APÓS ESTA PARTE! 🎉
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
