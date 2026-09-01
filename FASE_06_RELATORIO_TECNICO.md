# BIGofertas — Fase 06 — Relatório técnico

Data: 2026-09-01

## Objetivo

Implementar o carrinho definitivo da aplicação sem antecipar checkout, frete real, pedidos, pagamento ou estoque transacional. O pacote permanece de teste local e é cumulativo com as Fases 01–05.

## Implementado

### Modelo definitivo da linha de carrinho

O carrinho deixou de identificar itens somente pelo produto. Cada linha passa a usar `produto + variante`, permitindo que o mesmo produto em tamanhos/versões diferentes permaneça em linhas distintas.

Cada item persiste:

- ID do produto;
- slug do produto;
- ID da variante;
- SKU da variante;
- nome do produto;
- nome opcional da variante;
- opções selecionadas e respectivos valores;
- preço unitário estimado;
- imagem exibida;
- quantidade;
- estoque disponível conhecido;
- estado de disponibilidade.

### Persistência versionada

O `localStorage` do carrinho agora usa envelope versionado (`version: 2`).

O leitor é defensivo e:

- aceita o formato legado da Fase 01–05;
- descarta JSON inválido sem derrubar a aplicação;
- descarta entradas sem campos essenciais;
- mantém a proteção contra o antigo produto fictício;
- consolida linhas duplicadas da mesma variante;
- limita quantidades inválidas;
- marca itens antigos como `needs_review` quando não há variante segura registrada.

### Variantes e tamanhos

A página final do produto agora adiciona a variante realmente selecionada ao carrinho, incluindo as opções escolhidas. O bloqueio temporário da Fase 05 para produtos com variações foi removido.

### Quantidades

A quantidade é limitada pelo menor valor entre o estoque conhecido da variante e o limite defensivo por linha. O carrinho não permite aumentar uma linha marcada como indisponível, sem estoque ou pendente de revisão.

### Validação read-only no backend

Foi criada a migration:

`supabase/migrations/20260901031000_phase_06_definitive_cart_validation.sql`

Ela adiciona a função `public.validate_cart_items(jsonb)`, que valida itens em lotes de até 100 por chamada e retorna:

- produto ativo;
- variante ativa;
- SKU/nome atual da variante;
- preço efetivo atual;
- estoque disponível;
- slug/nome atual do produto;
- estado `available`, `out_of_stock`, `unavailable` ou `needs_review`.

A função é `STABLE`, `SECURITY INVOKER` e somente leitura. Ela **não reserva, decrementa nem modifica estoque**. Concorrência e reserva/decremento transacional continuam para a Fase 11.

O frontend divide carrinhos maiores em lotes de 100 para a validação.

### Interface do carrinho

A tela exibe:

- opções/tamanho da variante;
- SKU;
- disponibilidade;
- aviso para revisar itens legados;
- preço e subtotal explicitamente como estimados;
- frete como `A calcular`;
- aviso de inconsistências;
- ação manual para conferir o carrinho novamente.

A finalização continua desabilitada porque checkout, frete e pedidos pertencem a fases posteriores.

## Fora do escopo

Não foram implementados nesta fase:

- conexão com o novo Supabase remoto;
- aplicação remota das migrations;
- frete real;
- pedidos;
- checkout;
- InfinitePay;
- reserva/decremento transacional de estoque;
- carga definitiva dos produtos;
- carga definitiva das imagens;
- pacote Hostinger.

## Supabase

As credenciais do novo projeto Supabase fornecidas para uso futuro **não foram incorporadas ao projeto ou ao ZIP**. A conexão continua adiada até o encerramento da Fase 06; ela deve ocorrer antes da Fase 07.

## Validações executadas

- Fase 02: 20/20 validações estruturais aprovadas.
- Fase 03: 21/21 validações aprovadas.
- Fase 04: 33/33 validações aprovadas.
- Fase 05: 33/33 validações aprovadas no estado cumulativo.
- Fase 06: 39/39 validações aprovadas.
- 98 arquivos TypeScript/TSX sem erro sintático no `transpileModule`.
- JSON válido em 23 arquivos.
- TOML válido em 2 arquivos.
- 0 imports locais/aliases quebrados na auditoria estrutural.
- Testes executáveis do núcleo do carrinho confirmaram migração legada, tolerância a JSON corrompido, limite por estoque, linhas distintas por variante e consolidação da mesma variante.
- Nenhuma referência ao novo projeto/chave Supabase foi encontrada no pacote.

## Limitação do ambiente

Foi tentado `npm install --ignore-scripts --no-audit --no-fund`, mas a instalação excedeu o limite disponível antes de criar `node_modules`. Por isso `npm run build` e `npm run lint` completos não foram executados neste ambiente. Nenhuma instalação parcial foi mantida no pacote.

## Próximo marco

Antes de iniciar a Fase 07 — Administração de produtos, conectar o projeto ao Supabase de staging e aplicar/validar as migrations cumulativas das Fases 01–06.
