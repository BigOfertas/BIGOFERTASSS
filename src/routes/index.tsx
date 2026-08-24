/**
 * CONTEXTO:
 * - Projeto: BIGofertas (e-commerce esportivo)
 * - Stack: TanStack Start, TanStack Router, React 19, Supabase JS, Tailwind CSS v4
 * - Paleta: vermelho (red-600), branco, preto/gray-900
 * - Sem dark mode
 * - Sem integração com Supabase ainda (apenas mock data/interface)
 * 
 * OBJETIVO:
 * Criar rota `/cart` com página de carrinho funcional (estética).
 * 
 * FUNCIONALIDADES:
 * 
 * 1. ESTRUTURA DA PÁGINA:
 *    - Header: "Meu Carrinho"
 *    - Conteúdo em 2 colunas (lg) / 1 coluna (sm)
 *    - Esquerda: Lista de itens
 *    - Direita: Resumo do pedido (sticky no desktop)
 * 
 * 2. LISTA DE ITENS DO CARRINHO:
 *    - Cada item em card com:
 *      * Imagem do produto (esquerda, 100x100px)
 *      * Nome do produto (link para `/product/:id`)
 *      * Preço unitário (BRL)
 *      * Quantidade (input number, min 1, max 99)
 *      * Subtotal (preço × qty)
 *      * Botão "Remover" (ícone lixeira, hover vermelho)
 *    - Se carrinho vazio: mensagem "Seu carrinho está vazio" + link "Voltar às Compras"
 *    - Divisor entre itens
 * 
 * 3. RESUMO DO PEDIDO (card sticky):
 *    - Subtotal (soma de todos os itens)
 *    - Frete: R$ 15,00 (fixo, ou grátis se subtotal > R$ 150)
 *    - Desconto (mock, pode deixar R$ 0,00 ou aplicar % fixo)
 *    - TOTAL (bold, vermelho, tamanho grande)
 *    - Botão "Finalizar Compra" (red-600, full width, tamanho lg)
 *    - Botão "Continuar Comprando" (outline, abaixo)
 * 
 * 4. ESTILO:
 *    - Usar Tailwind CSS v4
 *    - Paleta: red-600 principal, gray-900 texto, white fundo
 *    - Sem dark mode
 *    - Botões com hover scale/opacity
 *    - Inputs de quantidade com incremento/decremento (ou input simples)
 *    - Divisores cinzas sutis (border-gray-200)
 * 
 * 5. MOCK DATA:
 *    - Criar contexto/hook `useCart()` que retorna:
 *      {
 *        items: [
 *          { id: '1', name: 'Camisa Brasil 2024', price: 89.90, qty: 2, image_url: '...' },
 *          { id: '2', name: 'Shorts Nike Azul', price: 119.90, qty: 1, image_url: '...' }
 *        ],
 *        removeItem: (id) => {},
 *        updateQty: (id, qty) => {},
 *        total: 299.60,
 *        subtotal: 284.60,
 *        shipping: 15.00
 *      }
 *    - Dados podem ser hardcoded ou em estado local (React.useState)
 * 
 * 6. INTERAÇÕES:
 *    - Clicar no X/Remover: remove item do carrinho
 *    - Alterar quantidade: atualiza subtotal e total em tempo real
 *    - "Continuar Comprando": volta para `/products`
 *    - "Finalizar Compra": navega para `/checkout` (a ser criada depois)
 * 
 * 7. RESPONSIVO:
 *    - Mobile (sm): 1 coluna, resumo acima da lista
 *    - Tablet (md): 1 coluna ainda
 *    - Desktop (lg+): 2 colunas, resumo sticky à direita
 * 
 * RESULTADO ESPERADO:
 * - Arquivo: `src/routes/cart.tsx`
 * - Hook/Contexto: `src/hooks/useCart.ts` (ou em `src/store/cart.ts`)
 * - Componentes auxiliares: opcional
 * - Build deve passar com 0 erros TypeScript
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
