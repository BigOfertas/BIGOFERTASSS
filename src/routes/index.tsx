/**
 * PROMPT PARA LOVABLE — ETAPA 11B
 * Estilo, Animações e Integração FAQ (Parte 2 de 2)
 * 
 * ================================================================================
 * 
 * CONTEXTO
 * 
 * PARTE 1 concluída: Componente FAQ.tsx criado com estrutura e lógica.
 * 
 * Esta é PARTE 2: Adicionar estilos, animações e integração à Home.
 * 
 * Pressupostos: Componente já existe e funciona.
 * 
 * ================================================================================
 * 
 * OBJETIVO
 * 
 * Estilizar o componente FAQ com:
 * - Cores BIG Ofertas
 * - Espaçamento profissional
 * - Animações suaves ao expandir/recolher
 * - Responsividade mobile/tablet/desktop
 * - Integração visual com o restante da Home
 * 
 * ================================================================================
 * 
 * MUDANÇA 1: ADICIONAR ESTILOS AO COMPONENTE FAQ
 * 
 * Arquivo: src/components/home/FAQ.tsx (já existe)
 * 
 * Atualizar: Adicionar classes Tailwind aos elementos
 * 
 * Título "PERGUNTAS FREQUENTES":
 * className="text-center text-3xl md:text-2xl font-bold italic uppercase mb-12 text-black"
 * 
 * Seção Container:
 * className="py-16 md:py-12 sm:py-8 bg-white"
 * 
 * Container Interno:
 * className="max-w-7xl mx-auto px-4 lg:px-8"
 * 
 * Grid de Accordions:
 * className="max-w-2xl mx-auto space-y-3"
 * 
 * Cada Item (Accordion):
 * className="border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all duration-200"
 * 
 * Button (Header - Clicável):
 * className="w-full px-5 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors duration-200"
 * 
 * Texto da Pergunta (dentro do button):
 * className="flex items-center gap-3 text-left"
 * Emoji: className="text-xl"
 * Pergunta: className="font-semibold text-gray-800 text-sm md:text-base"
 * 
 * Chevron Icon (seta):
 * className="text-red-600 w-5 h-5 flex-shrink-0"
 * rotation: 0deg (fechado) → 180deg (aberto)
 * transform: transition-transform duration-300 ease-in-out
 * 
 * Content (Resposta):
 * className="px-5 py-4 text-gray-600 text-sm leading-relaxed whitespace-pre-wrap"
 * 
 * ================================================================================
 * 
 * MUDANÇA 2: ADICIONAR ANIMAÇÕES
 * 
 * Arquivo: src/components/home/FAQ.tsx
 * 
 * Chevron Rotation Animação:
 * - Quando aberto: rotate-180
 * - Quando fechado: rotate-0
 * - Transição: duration-300 ease-in-out
 * - Implementar com className ternário:
 *   `transition-transform duration-300 ease-in-out ${
 *     openId === item.id ? 'rotate-180' : 'rotate-0'
 *   }`
 * 
 * Content Fade Animação:
 * - Usar max-height para controlar abertura
 * - Estado fechado: max-height-0, opacity-0
 * - Estado aberto: max-height-500px, opacity-1
 * - Transição: 300ms ease-in-out
 * - Implementar com conditional rendering + className:
 *   `overflow-hidden transition-all duration-300 ease-in-out ${
 *     openId === item.id 
 *       ? 'max-h-96 opacity-100' 
 *       : 'max-h-0 opacity-0'
 *   }`
 * 
 * Duração Total: 300ms (mesmo padrão ShopByLeague/BestSellers)
 * Easing: ease-in-out
 * 
 * ================================================================================
 * 
 * MUDANÇA 3: ADICIONAR CORES EXATAS
 * 
 * Arquivo: src/components/home/FAQ.tsx
 * 
 * Substituir cores genéricas:
 * 
 * Fundo: #ffffff (branco)
 * Fundo Item: #f9fafb (gray-50)
 * Fundo Hover: #f3f4f6 (gray-100)
 * Border: #e5e7eb (gray-200)
 * Texto Pergunta: #1f2937 (gray-800)
 * Texto Resposta: #4b5563 (gray-600)
 * Icon Chevron: #dc2626 (vermelho BIG Ofertas)
 * Icon Hover: #991b1b (vermelho escuro)
 * 
 * No Tailwind:
 * - bg-white
 * - bg-gray-50
 * - hover:bg-gray-100
 * - border-gray-200
 * - text-gray-800
 * - text-gray-600
 * - text-red-600
 * 
 * ================================================================================
 * 
 * MUDANÇA 4: RESPONSIVIDADE
 * 
 * Arquivo: src/components/home/FAQ.tsx
 * 
 * Desktop (lg ≥ 1024px):
 * - Titulo: text-3xl
 * - Pergunta: text-base
 * - Resposta: text-sm
 * - Padding: px-5 py-4
 * - Padding seção: py-16
 * 
 * Tablet (md 768px-1023px):
 * - Titulo: text-2xl
 * - Pergunta: text-base (mesmo)
 * - Resposta: text-sm (mesmo)
 * - Padding: px-4 py-3
 * - Padding seção: py-12
 * 
 * Mobile (< 768px):
 * - Titulo: text-xl
 * - Pergunta: text-sm
 * - Resposta: text-xs
 * - Padding: px-4 py-3
 * - Padding seção: py-8
 * 
 * Implementar com Tailwind breakpoints:
 * - text-xl md:text-2xl lg:text-3xl
 * - px-4 md:px-5
 * - py-8 md:py-12 lg:py-16
 * 
 * ================================================================================
 * 
 * MUDANÇA 5: INTEGRAÇÃO NA HOME
 * 
 * Arquivo: src/routes/index.tsx
 * 
 * Adicionar import no topo:
 * import FAQ from "@/components/home/FAQ";
 * 
 * Encontrar: <ShopByLeague />
 * 
 * Adicionar APÓS:
 * <FAQ />
 * 
 * Ordem completa deve ser:
 * 1. BestSellers
 * 2. VisualCategories
 * 3. PromoBanner (Brasileirão)
 * 4. BrazilianTeams
 * 5. BrazilianProducts
 * 6. ShopByLeague
 * 7. FAQ ← NOVO (aqui)
 * 8. (Footer virá depois)
 * 
 * Sem outras alterações em index.tsx.
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