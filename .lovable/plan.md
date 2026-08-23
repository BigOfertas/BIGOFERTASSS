# Etapa 9 — Seção "COMPRE POR LIGA"

Criação da seção "COMPRE POR LIGA" na Home, com navegação por abas e carrossel de produtos responsivo, seguindo os padrões visuais e funcionais da BIGofertas.

## Mudanças propostas

### Componentes de Interface
- **Criar `src/components/home/ShopByLeague.tsx`**: Novo componente centralizando a lógica da seção.
  - Título centralizado "COMPRE POR LIGA".
  - Navegação por abas com 5 ligas: La Liga, Premier League, Serie A, Bundesliga, Ligue 1.
  - Gerenciamento de estado para a liga ativa e reset de paginação ao trocar de liga.
  - Implementação de transição por crossfade (opacidade) entre os grupos de produtos.
  - Mock de dados (15 produtos por liga) preparado para futura integração com Supabase.
  - Integração com o componente `ProductCarousel` existente para manter consistência.

### Estilização e Layout
- **Desktop**:
  - Exibição de 5 produtos por vez.
  - 3 bolinhas de paginação com contorno (preta para ativa, branca para inativas).
  - Transição de crossfade suave (250-350ms).
- **Mobile**:
  - Abas em linha horizontal rolável (sem scrollbar visível).
  - Produtos em rolagem horizontal livre (swipe) com barra de progresso discreta.
  - Sem bolinhas de paginação no mobile.

### Integração na Home
- **Atualizar `src/routes/index.tsx`**:
  - Inserir a nova seção `ShopByLeague` imediatamente após a seção "Produtos do Brasileirão".
  - Atualizar o cabeçalho de documentação do arquivo com o novo prompt.

## Detalhes técnicos
- Reutilização dos componentes `ProductCard` e `ProductCarousel`.
- Uso de `AnimatePresence` ou classes CSS de transição do Tailwind para o efeito de crossfade.
- Arquitetura preparada para filtros dinâmicos via `league_id` no futuro.
- Sem novas dependências externas; uso exclusivo de React, Tailwind e Lucide (se necessário).
- Preservação total de todas as seções e comportamentos mobile/desktop já aprovados.
