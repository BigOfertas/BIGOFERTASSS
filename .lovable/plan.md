# Plan - Ajustar seção “Mais vendidos” / “Lançamentos” na Home

Refinar a seção de produtos para incluir abas centralizadas, paginação por bolinhas e navegação em grupos de 5 produtos, removendo barras de rolagem visíveis.

## Componentes a ajustar

### 1. `src/components/home/BestSellers.tsx`
* Renomear ou ajustar para suportar abas: "MAIS VENDIDOS" e "LANÇAMENTOS".
* Implementar estado para a aba ativa.
* Centralizar os títulos das abas horizontalmente na mesma linha.
* Aumentar o mock data para 10 produtos por categoria (para permitir 2 grupos de 5).
* Adicionar o componente de navegação por bolinhas abaixo do carrossel.

### 2. `src/components/product/ProductCarousel.tsx`
* Adicionar suporte a navegação por bolinhas (dots).
* Garantir que a troca de bolinhas mova o carrossel em blocos de 5 produtos.
* Remover qualquer aparência de barra de rolagem horizontal.
* Manter o comportamento de swipe no mobile, mas sincronizado com as bolinhas se possível, ou focar na navegação por cliques conforme solicitado.
* Centralizar as bolinhas abaixo do carrossel.

## Detalhes Visuais
* **Títulos**: Estilo "MAIS VENDIDOS LANÇAMENTOS", centralizado.
* **Bolinhas**: 2 bolinhas discretas, a ativa com destaque.
* **Produtos**: Exatamente 5 por vez no desktop.

## Restrições
* Manter Header, Banners e CategoryNav intactos.
* Sem alterações no Supabase, Auth ou Banco de Dados.
* Focar apenas na experiência visual e funcional da seção de produtos.
