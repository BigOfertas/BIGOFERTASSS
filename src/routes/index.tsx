/**
 * # PROMPT CORRETIVO — TIMES BRASILEIROS + CARROSSEL INFINITO DE CATEGORIAS NO DESKTOP
 * 
 * Considere o **estado ATUAL do projeto BIGofertas** como fonte de verdade.
 * 
 * Faça SOMENTE as duas correções abaixo.
 * 
 * ---
 * 
 * # 1. DESKTOP — “TIMES BRASILEIROS” COM 11 TIMES SIMÉTRICOS
 * 
 * Na seção **TIMES BRASILEIROS**, existe uma lista com exatamente **11 clubes**.
 * 
 * No DESKTOP, quero que os 11 apareçam na mesma linha, com:
 * 
 * * espaçamento perfeitamente uniforme;
 * * distribuição simétrica;
 * * nenhum escudo cortado;
 * * nenhum item parcialmente escondido;
 * * nenhum clube encostando no outro;
 * * mesmas áreas reservadas para cada clube;
 * * alinhamento vertical consistente;
 * * primeiro e último clubes com margens laterais equivalentes.
 * 
 * Os 11 clubes devem ocupar a largura útil da seção de maneira equilibrada.
 * 
 * ## Estrutura visual desejada
 * 
 * Algo conceitualmente equivalente a:
 * 
 * `[1]   [2]   [3]   [4]   [5]   [6]   [7]   [8]   [9]   [10]   [11]`
 * 
 * Todos com exatamente o mesmo espaço reservado.
 * 
 * Não quero:
 * 
 * * último escudo cortado;
 * * primeiro escudo grudado na borda;
 * * espaços muito maiores entre alguns clubes;
 * * logos sobrepostos;
 * * largura irregular entre os itens.
 * 
 * ---
 * 
 * ## COMO DISTRIBUIR
 * 
 * Utilizar uma estrutura própria para os **11 itens**, como grid/flex adequadamente dimensionado.
 * 
 * Cada time deve possuir um slot de largura equivalente.
 * 
 * O escudo deve ficar centralizado dentro desse slot.
 * 
 * A proporção original de cada escudo deve continuar preservada.
 * 
 * Usar comportamento equivalente a:
 * 
 * `object-contain`
 * 
 * Nunca deformar logos para fazê-los ocupar a mesma forma.
 * 
 * O que deve ser igual é **a área/slot destinada ao clube**, não necessariamente a largura real do desenho do escudo.
 * 
 * ---
 * 
 * ## NÃO REDUZIR DEMAIS OS ESCUDOS
 * 
 * Não resolver o problema simplesmente tornando todos os escudos minúsculos.
 * 
 * Eles devem continuar com boa presença visual.
 * 
 * Se necessário:
 * 
 * * utilizar melhor a largura disponível da seção;
 * * ajustar `max-width` do container específico dos times;
 * * diminuir moderadamente apenas os gaps;
 * * distribuir os 11 slots de forma matemática e uniforme.
 * 
 * Não mexer no container global da Home.
 * 
 * ---
 * 
 * # 2. DESKTOP — “DIVERSIFIQUE SEU PEDIDO” COM ROLAGEM INFINITA
 * 
 * No DESKTOP, transformar os cards da seção:
 * 
 * **DIVERSIFIQUE SEU PEDIDO**
 * 
 * em um carrossel horizontal automático e infinito.
 * 
 * ## COMPORTAMENTO
 * 
 * Os cards devem ficar constantemente se movimentando horizontalmente de maneira:
 * 
 * * suave;
 * * contínua;
 * * lenta;
 * * elegante;
 * * linear;
 * * sem travadas;
 * * sem saltos.
 * 
 * Preferencialmente da direita para a esquerda.
 * 
 * Não quero um slider tradicional que troca uma página inteira por outra.
 * 
 * Quero uma **esteira horizontal contínua**.\n\n---\n\n# LOOP REALMENTE INFINITO\n\nA animação deve formar um loop visual perfeito.\n\nQuando o último card passar, a sequência deve continuar imediatamente pelo primeiro, sem:\n\n* espaço em branco;\n* piscada;\n* salto;\n* reposicionamento perceptível.\n\nPode duplicar visualmente a sequência para criar o loop.\n\nExemplo conceitual:\n\n`[1][2][3][4][5][6] [1][2][3][4][5][6]`\n\nEssa duplicação é apenas visual para a animação.\n\nNão duplicar dados reais.\n\n---\n\n# PAUSAR QUANDO PASSAR O MOUSE\n\nNo DESKTOP:\n\nQuando o usuário colocar o mouse sobre qualquer parte do carrossel:\n\n**a animação deve pausar suavemente exatamente na posição atual.**\n\nNão voltar para o início.\n\nNão mudar a posição dos cards.\n\nNão fazer fade.\n\nApenas congelar o movimento horizontal.\n\n---\n\n# VOLTAR AO RETIRAR O MOUSE\n\nQuando o usuário retirar o mouse da seção:\n\n**a animação deve continuar automaticamente a partir do mesmo ponto.**\n\nNão reiniciar.\n\nNão pular.\n\nNão acelerar bruscamente.\n\nRetomar na mesma velocidade suave utilizada antes.\n\nComportamento esperado:\n\n`movendo → hover → pausa → mouse sai → continua`\n\n---\n\n# VELOCIDADE\n\nUsar uma velocidade confortável para leitura.\n\nNão quero:\n\n* movimento muito rápido;\n* categorias passando antes do usuário conseguir identificá-las;\n* sensação de ticker de notícias.\n\nQuero uma movimentação lenta de e-commerce premium.\n\nA animação deve utilizar velocidade constante, sem aceleração/desaceleração entre cards.\n\n---\n\n# TAMANHO DOS CARDS\n\nMuito importante:\n\n**NÃO ALTERAR O TAMANHO JÁ APROVADO DOS CARDS DE “DIVERSIFIQUE SEU PEDIDO”.**\n\nEles já possuem regra própria de tamanho.\n\nManter:\n\n* largura;\n* altura;\n* proporção 2:3;\n* espaçamento interno;\n* nome das categorias;\n* futura área da arte clicável.\n\nAdicionar somente a mecânica de movimento.\n\n---\n\n# MOBILE — NÃO ALTERAR\n\nEssas mudanças de carrossel infinito são exclusivamente para DESKTOP.\n\nNo MOBILE, a seção Diversifique deve continuar exatamente com o comportamento atual:\n\n* rolagem horizontal manual;\n* swipe;\n* usuário controla o movimento;\n* sem autoplay;\n* sem carrossel automático infinito.\n\nNão adicionar pausa por toque.\n\nNão alterar tamanho dos cards mobile.\n\n---\n\n# TIMES BRASILEIROS NO MOBILE\n\nTambém NÃO alterar o comportamento mobile já definido para Times Brasileiros.\n\nManter:\n\n* scroll horizontal;\n* swipe;\n* barra indicadora;\n* tamanhos atuais.\n\nA correção de distribuição dos 11 clubes é exclusivamente desktop.\n\n---\n\n# PERFORMANCE\n\nNão instalar biblioteca externa apenas para fazer esse movimento.\n\nPreferir:\n\n* CSS;\n* Tailwind;\n* React atual.\n\nSe utilizar animação CSS, implementar loop contínuo eficiente.\n\nEvitar re-renderização React a cada frame.\n\n---\n\n# ACESSIBILIDADE\n\nRespeitar `prefers-reduced-motion`.\n\nSe o usuário tiver redução de movimento ativada, evitar autoplay contínuo agressivo.\n\n---\n\n# NÃO ALTERAR\n\nNão modificar:\n\n* Header;\n* menu;\n* busca;\n* PNG Slot Superior;\n* PNG Slot Inferior;\n* Banner Brasileirão;\n* tamanho do Banner Brasileirão;\n* Mais Vendidos;\n* Lançamentos;\n* cards de produtos;\n* Produtos do Brasileirão;\n* tamanho dos cards de categorias;\n* Supabase;\n* Auth;\n* RLS;\n* migrations;\n* TanStack Router;\n* `.lovable`.\n\nNão gerar imagens.\n\nNão realizar refatorações adicionais.\n\n---\n\n# VALIDAÇÃO FINAL\n\nAntes de finalizar, confirmar:\n\n### Times Brasileiros — Desktop\n\n1. Existem exatamente 11 clubes.\n2. Todos estão visíveis simultaneamente.\n3. Nenhum escudo está cortado.\n4. Primeiro e último possuem margens equivalentes.\n5. Espaçamento entre os 11 é uniforme.\n6. Cada clube possui um slot simétrico.\n7. Escudos permanecem com proporção original.\n\n### Diversifique — Desktop\n\n8. Cards se movimentam automaticamente.\n9. Movimento é horizontal e contínuo.\n10. Loop é infinito.\n11. Não existe salto ao reiniciar.\n12. Não existe espaço vazio.\n13. Ao colocar o mouse sobre a seção, o movimento pausa.\n14. Ao retirar o mouse, continua exatamente de onde parou.\n15. Velocidade permanece suave e constante.\n16. Tamanho dos cards não foi alterado.\n\n### Mobile\n\n17. Diversifique continua com swipe manual.\n18. Times Brasileiros continua com comportamento mobile existente.\n19. Nenhum tamanho mobile foi alterado.\n\n**Faça exclusivamente estas duas correções.**\n */
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