/**
 * # ETAPA 8 — Finalizar seção “PRODUTOS DO BRASILEIRÃO”
 * 
 * Considere o **estado ATUAL do projeto BIGofertas** como fonte de verdade.
 * 
 * Faça SOMENTE a criação/refinamento da seção:
 * 
 * **PRODUTOS DO BRASILEIRÃO**
 * 
 * Essa seção deverá permanecer logo abaixo da área do Brasileirão/Times Brasileiros já existente.
 * 
 * Não avance ainda para “Compre por Liga”.
 * 
 * ---
 * 
 * ## 1. TÍTULO
 * 
 * Manter o título:
 * 
 * **PRODUTOS DO BRASILEIRÃO**
 * 
 * Centralizado e seguindo a identidade visual atual da BIGofertas.
 * 
 * Não exagerar no tamanho.
 * 
 * Não alterar os títulos das seções anteriores.
 * 
 * ---
 * 
 * # 2. DESKTOP — 5 PRODUTOS POR VEZ
 * 
 * No desktop, mostrar exatamente:
 * 
 * **5 produtos por grupo**
 * 
 * Estrutura:
 * 
 * * grupo 1 → produtos 1–5
 * * grupo 2 → produtos 6–10
 * * grupo 3 → produtos 11–15
 * 
 * Nunca mostrar os 15 simultaneamente.
 * 
 * Cada card deve conter a estrutura de produto já utilizada no projeto:
 * 
 * * imagem;
 * * nome;
 * * preço;
 * * botão “ADICIONAR AO CARRINHO”.
 * 
 * Reutilizar o mesmo padrão visual dos cards de **Mais Vendidos/Lançamentos**.
 * 
 * Não criar um novo estilo de card.
 * 
 * ---
 * 
 * # 3. DESKTOP — 3 BOLINHAS
 * 
 * Abaixo dos produtos, exibir exatamente:
 * 
 * **3 bolinhas centralizadas**
 * 
 * Representação:
 * 
 * `●  ○  ○`
 * 
 * Cada bolinha corresponde a um grupo de 5 produtos.
 * 
 * ### Bolinha ativa
 * 
 * * fundo preto/escuro;
 * * contorno visível;
 * * claramente destacada.
 * 
 * ### Bolinhas inativas
 * 
 * * fundo claro;
 * * contorno preto/cinza-escuro;
 * * claramente visíveis e clicáveis.
 * 
 * Todas as bolinhas devem possuir contorno.
 * 
 * Deixar os indicadores mais destacados, mas ainda elegantes.
 * 
 * ---
 * 
 * # 4. DESKTOP — TROCA POR FADE
 * 
 * Ao clicar em outra bolinha, trocar os produtos através exclusivamente de:
 * 
 * **FADE OUT + FADE IN**
 * 
 * O grupo atual:
 * 
 * `opacity: 1 → 0`
 * 
 * Enquanto o novo grupo:
 * 
 * `opacity: 0 → 1`
 * 
 * As duas animações devem acontecer simultaneamente, criando um **crossfade**.
 * 
 * Duração aproximada:
 * 
 * **250–350ms**
 * 
 * Não utilizar:
 * 
 * * slide;
 * * deslocamento lateral;
 * * zoom;
 * * scale;
 * * movimento vertical.
 * 
 * Apenas opacidade.
 * 
 * ---
 * 
 * # 5. MOBILE — SEM BOLINHAS
 * 
 * No MOBILE:
 * 
 * **NÃO utilizar as 3 bolinhas.**
 * 
 * A navegação deve funcionar por rolagem horizontal natural.
 * 
 * Quero:
 * 
 * * produtos lado a lado;
 * * swipe com o dedo;
 * * usuário deslizando livremente para direita/esquerda;
 * * sem divisão visual em páginas;
 * * sem fade ao deslizar;
 * * sem setas;
 * * sem dots.
 * 
 * ---
 * 
 * # 6. MOBILE — BARRA ABAIXO DOS PRODUTOS
 * 
 * No mobile, colocar apenas uma:
 * 
 * **barra horizontal discreta abaixo dos cards**
 * 
 * Essa barra deverá indicar a posição atual da rolagem.
 * 
 * Seguir a mesma lógica visual utilizada nas outras áreas horizontais mobile do projeto.
 * 
 * A barra deve:
 * 
 * * ser fina;
 * * discreta;
 * * centralizada;
 * * acompanhar o scroll;
 * * não ocupar espaço exagerado;
 * * não causar overflow horizontal na página.
 * 
 * ---
 * 
 * # 7. MOBILE — PRESERVAR TAMANHOS
 * 
 * Não alterar novamente a escala dos cards mobile.
 * 
 * Usar exatamente o mesmo tamanho de card de produto já aprovado em:
 * 
 * **Mais Vendidos / Lançamentos**
 * 
 * Não aumentar.
 * 
 * Não diminuir.
 * 
 * A seção Brasileirão deve ter consistência com os demais produtos da Home.
 * 
 * ---
 * 
 * # 8. PRODUTOS REAIS VIRÃO DEPOIS
 * 
 * Por enquanto, se ainda não houver produtos reais:
 * 
 * * manter placeholders/mocks existentes;
 * * não buscar imagens na internet;
 * * não inventar camisas;
 * * não inventar preços adicionais;
 * * não gerar imagens.
 * 
 * A estrutura deve ficar preparada para futuramente receber os produtos do Supabase.
 * 
 * ---
 * 
 * # 9. FUTURA FILTRAGEM POR TIME
 * 
 * Deixar a arquitetura preparada para que, futuramente, ao clicar em um time na seção:
 * 
 * **TIMES BRASILEIROS**
 * 
 * seja possível exibir produtos correspondentes àquele clube.
 * 
 * Exemplo futuro:
 * 
 * `Flamengo → produtos do Flamengo`
 * 
 * `Palmeiras → produtos do Palmeiras`
 * 
 * `Corinthians → produtos do Corinthians`
 * 
 * Mas NÃO implementar banco/filtro definitivo nesta etapa.
 * 
 * Apenas evitar uma estrutura que impeça essa integração posteriormente.
 * 
 * ---
 * 
 * # 10. REUTILIZAÇÃO
 * 
 * Reutilizar, sempre que possível, o mesmo componente de produto/paginação já utilizado em:
 * 
 * * Mais Vendidos;
 * * Lançamentos.
 * 
 * A lógica responsiva deve permanecer:
 * 
 * ### Desktop
 * 
 * 5 produtos + 3 bolinhas + crossfade.
 * 
 * ### Mobile
 * 
 * scroll horizontal + barra.
 * 
 * Não duplicar código desnecessariamente.
 * 
 * ---
 * 
 * # 11. NÃO ALTERAR
 * 
 * Não modificar:
 * 
 * * Header;
 * * busca;
 * * menu;
 * * PNG Slot Superior;
 * * PNG Slot Inferior;
 * * Diversifique seu pedido;
 * * cards das categorias;
 * * PNG Slot Brasileirão;
 * * tamanho mobile já corrigido do banner Brasileirão;
 * * Times Brasileiros;
 * * Mais Vendidos;
 * * Lançamentos;
 * * Supabase;
 * * Auth;
 * * RLS;
 * * migrations;
 * * TanStack Router;
 * * `.lovable`;
 * * rodapé.
 * 
 * Não realizar refatorações fora dessa seção.
 * 
 * ---
 * 
 * # 12. VALIDAÇÃO FINAL
 * 
 * Confirmar:
 * 
 * 1. Desktop mostra exatamente 5 produtos por vez.
 * 2. Existem 3 grupos possíveis de produtos.
 * 3. Existem exatamente 3 bolinhas no desktop.
 * 4. Todas possuem contorno.
 * 5. A ativa está preenchida em preto.
 * 6. A troca desktop acontece somente por crossfade de opacidade.
 * 7. Mobile não apresenta bolinhas.
 * 8. Mobile funciona por swipe horizontal.
 * 9. Mobile possui barra horizontal abaixo dos produtos.
 * 10. Cards mantêm exatamente o tamanho já aprovado.
 * 11. Não existe overflow horizontal na página.
 * 12. Seções anteriores permanecem intactas.
 * 13. A estrutura está preparada para integração futura com produtos reais e times.
 * 
 * **Faça exclusivamente esta etapa da seção “PRODUTOS DO BRASILEIRÃO”.**
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
      </main>
    </div>
  );
}