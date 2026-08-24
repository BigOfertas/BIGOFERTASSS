/**
 * PROMPT PARA LOVABLE — ETAPA 18B1 (PARTE 2A)
 * Footer BIGofertas: Estilo Tailwind CSS Base
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * Você vai criar a PARTE 2A do Footer profissional para BIGofertas.
 * 
 * Esta é PARTE 2A de 3:
 * - PARTE 1 (COMPLETA): Estrutura HTML + Conteúdo ✅
 * - PARTE 2A (AGORA): Estilo Tailwind CSS (cores, layout, tipografia)
 * - PARTE 2B: Accordions (mobile) + Animações
 * 
 * Arquivo: src/components/layout/Footer.tsx (JÁ EXISTE COM ESTRUTURA)
 * 
 * O que fazer:
 * - Aplicar cores BIGofertas em todo footer
 * - Estilizar layout (desktop 4 colunas, mobile 1 coluna)
 * - Tipografia correta (tamanhos, pesos)
 * - Espaçamento e padding
 * - Sem accordions ainda (será PARTE 2B)
 * - Sem animações ainda (será PARTE 2B)
 * 
 * ================================================================================
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

import bannerInferiorAsset from "@/assets/promos/banner-promo-inferior.png.asset.json";
import bannerSuperiorAsset from "@/assets/promos/banner-promo-superior.png.asset.json";

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
          bannerSuperiorAsset.url, // Slot 1
          bannerSuperiorAsset.url, // Slot 2
          bannerSuperiorAsset.url, // Slot 3
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
          bannerInferiorAsset.url, // Slot 1
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

    </div>
  );
}
