/**
 * PROMPT PARA LOVABLE — ETAPA 16A (PARTE 1)
 * Integrar Imagens dos Escudos - Times Brasileiros (Imagens 1 a 3)
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * Você vai receber as PRIMEIRAS 3 IMAGENS de escudos para integrar na seção
 * "Times Brasileiros" (BrazilianTeams).
 * 
 * Esta é PARTE 1 de 3:
 * - PARTE 1 (AGORA): Imagens 1, 2, 3 (primeiras 3 escudos à esquerda)
 * - PARTE 2: Imagens 4, 5, 6 (próximos 3 escudos)
 * - PARTE 3: Imagens 7, 8, 9, 10, 11 (últimos 5 escudos)
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * Integrar as 3 PRIMEIRAS imagens de escudos no carrossel "Times Brasileiros"
 * 
 * Ordem EXATA:
 * - Imagem 1 anexada = Posição 1 (1ª esquerda)
 * - Imagem 2 anexada = Posição 2
 * - Imagem 3 anexada = Posição 3
 * 
 * ================================================================================
 * 
 * MUDANÇA ESPECÍFICA: ARQUIVO BrazilianTeams.tsx
 * 
 * Arquivo: src/components/home/BrazilianTeams.tsx
 * 
 * Contexto:
 * Array de teams que exibe 11 escudos em carrossel
 * 
 * Integração PARTE 1:
 * Substituir as PRIMEIRAS 3 posições do array com as imagens anexadas
 * 
 * Estrutura esperada (primeiras 3 items):
 * 
 * const teams = [
 *   {
 *     id: 1,
 *     name: "Time 1",
 *     image: "[IMAGEM 1 ANEXADA - PRIMEIRA ESQUERDA]"
 *   },
 *   {
 *     id: 2,
 *     name: "Time 2",
 *     image: "[IMAGEM 2 ANEXADA - SEGUNDA ESQUERDA]"
 *   },
 *   {
 *     id: 3,
 *     name: "Time 3",
 *     image: "[IMAGEM 3 ANEXADA - TERCEIRA ESQUERDA]"
 *   },
 *   // [RESTO DO ARRAY MANTÉM COMO ESTAVA - PLACEHOLDERS POR ENQUANTO]
 *   {
 *     id: 4,
 *     name: "Time 4",
 *     image: "[PLACEHOLDER - SERÁ PREENCHIDO NA PARTE 2]"
 *   },
 *   // ... items 5-11 continuam com placeholder
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