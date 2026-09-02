# FASE 10 — Núcleo Definitivo de Pedidos

Data de fechamento técnico: 2026-09-02

## Status

**Código da Fase 10: implementado e auditado.**

**Aplicação no Supabase remoto: pendente de confirmação/aplicação das migrations da Fase 10.**

A Fase 09 continua bloqueada por dependências externas de frete. A antiga Fase 11 baseada em estoque/reservas foi cancelada porque a BIGofertas trabalha com produção sob encomenda.

## Regra de negócio consolidada

A BIGofertas é uma loja simples, com um único proprietário. Não é SaaS, marketplace, multitenant, ERP ou plataforma de atendimento.

Os produtos são produzidos sob encomenda. A disponibilidade comercial depende de produto/variante ativos, e não de quantidade física em estoque.

Prazo comercial de produção: **até 5 dias úteis antes do envio**. O prazo de transporte será tratado separadamente quando a Fase 09 for concluída.

Casos excepcionais são resolvidos diretamente pelo proprietário com o cliente, sem criação de workflows empresariais desnecessários.

## Implementação principal

### Banco

Migration principal:

- `supabase/migrations/20260902040000_phase_10_definitive_order_core.sql`

Hardening adicional:

- `supabase/migrations/20260902041000_phase_10_order_integrity_hardening.sql`

Estruturas principais:

- `orders`
- `order_items`
- `order_timeline`
- `refund_requests`
- `notification_events`
- sequência `order_public_number_seq`

### Número humano do pedido

Formato:

`BIG-AAAA-NNNNNN`

Exemplo:

`BIG-2026-000001`

O UUID continua sendo a identificação interna. Segurança não depende de o número público ser difícil de adivinhar; acesso é protegido por autenticação, RLS e autorização.

## Snapshots históricos

Os pedidos preservam dados históricos do momento da compra.

Itens armazenam snapshot de:

- produto;
- slug;
- SKU do produto;
- variante;
- SKU da variante;
- opções selecionadas;
- imagem de referência;
- quantidade;
- preço unitário;
- total da linha.

O pedido preserva snapshot de:

- nome do cliente;
- e-mail;
- telefone;
- destinatário;
- CEP;
- rua;
- número;
- complemento;
- bairro;
- cidade;
- UF;
- subtotal;
- desconto;
- frete;
- total.

Triggers protegem snapshots e itens históricos contra alteração indevida.

## Fluxo simples de pedido

Estados operacionais implementados:

- `pending_payment`
- `paid`
- `in_production`
- `shipped`
- `delivered`
- `canceled`
- `refunded`

Fluxo normal:

`Aguardando pagamento → Pago → Em produção → Enviado → Entregue`

Cancelamento direto administrativo fica restrito ao pedido ainda aguardando pagamento. Casos posteriores são resolvidos pelo atendimento direto e, quando necessário, pelo fluxo simples de reembolso.

## Produção sob encomenda

A Fase 10 remove a dependência comercial de estoque do validador do carrinho.

Campos legados de estoque foram preservados estruturalmente para evitar remoção destrutiva de schema, porém não determinam mais a disponibilidade comercial do produto.

Não foram implementados:

- reserva de estoque;
- baixa de estoque;
- estoque reservado;
- expiração de reserva;
- concorrência pela última unidade;
- inventory locking.

A UX informa de forma explícita:

**“Produção em até 5 dias úteis antes do envio.”**

## Reembolso

O processo foi mantido propositalmente simples.

Fluxo:

1. cliente solicita reembolso pelo pedido;
2. a solicitação é registrada;
3. o proprietário visualiza a solicitação;
4. proprietário e cliente conversam diretamente;
5. o proprietário registra o resultado como `refunded` ou `canceled` na solicitação.

Marcar como reembolsado **não executa transferência financeira automática**. Apenas registra que o proprietário já resolveu o caso pelo meio apropriado.

Não existem:

- chat interno;
- ticketing;
- central de disputas;
- agentes/departamentos;
- reembolso parcial;
- carteira;
- ledger financeiro.

## Segurança e RLS

RLS está habilitada nas tabelas sensíveis da Fase 10.

Cliente autenticado pode ler apenas:

- seus próprios pedidos;
- seus próprios itens;
- sua própria timeline;
- suas próprias solicitações de reembolso.

Escrita direta das tabelas sensíveis por `authenticated` foi revogada.

Operações administrativas usam funções protegidas com verificação de papel `owner`.

Criação de pedido e confirmação futura de pagamento são restritas ao `service_role`, não ao navegador.

Nenhum secret ou `service_role` é enviado ao frontend.

## Hardening de idempotência

A auditoria final identificou duas garantias que valia a pena tornar explícitas antes da aplicação remota.

A migration `20260902041000_phase_10_order_integrity_hardening.sql` adiciona:

- `idempotency_key` obrigatória para pedidos reais;
- índice único para `(payment_provider, payment_reference)` quando preenchidos;
- lock do pedido antes da verificação do evento de pagamento;
- proteção contra reaproveitar o mesmo evento de pagamento em outro pedido;
- proteção contra retry com provider, referência ou valor divergentes;
- confirmação de pagamento ainda restrita exclusivamente ao backend/service role.

Isso mantém o sistema simples, mas evita duplicidade e associação incorreta de pagamento em retries/webhooks futuros.

## Área do cliente

Implementado:

- `Minha Conta → Pedidos`;
- histórico real, sem mocks;
- empty state quando não existem pedidos;
- número do pedido;
- data;
- status;
- valor;
- quantidade de itens;
- detalhe do pedido;
- timeline;
- endereço snapshot;
- informações de produção;
- solicitação de reembolso quando elegível.

Rota de detalhe:

- `/conta/pedidos/$orderNumber`

A RLS impede que conhecer/adivinhar um número público permita acesso ao pedido de outro cliente.

## Admin

Implementado no painel do owner:

- lista de pedidos;
- busca;
- filtro por status;
- ordenação;
- paginação;
- detalhe completo;
- dados essenciais do cliente;
- timeline;
- atualização do fluxo operacional permitido;
- visualização da solicitação de reembolso;
- registro de reembolso concluído ou cancelado.

Ações relevantes utilizam modal interno do site. Não são usados `window.alert`, `window.confirm` ou `window.prompt`.

## UX/UI

Foram adicionados:

- skeletons;
- loading states;
- empty states;
- error states;
- badges de status;
- cards responsivos;
- timeline visual;
- transições e microinterações;
- backdrop blur em dialogs;
- feedback por toast;
- suporte a `prefers-reduced-motion` nas animações específicas da timeline.

O objetivo continua sendo uma loja operacionalmente simples, porém visualmente fluida e bem acabada.

## Preparação para frete

A Fase 09 continua bloqueada e nenhuma cotação foi inventada.

O pedido já possui campos opcionais para snapshot futuro de:

- provider;
- serviço;
- referência da cotação;
- valor-base;
- valor adicional;
- valor total do frete;
- prazo de transporte;
- data da cotação;
- rastreio.

A regra futura de Loggi com adicional fixo poderá ser armazenada separando tarifa-base e adicional, sem falsificar o valor retornado pela transportadora.

## Preparação para pagamento

A Fase 10 não implementa gateway de pagamento.

A estrutura está preparada para:

- provider;
- referência externa;
- método;
- valor pago;
- `paid_at`;
- confirmação idempotente pelo backend.

## Preparação para e-mails

Existe um outbox mínimo em `notification_events`, sem CPF, telefone ou endereço no payload.

Eventos previstos:

- `account.confirmed`
- `order.paid`
- `order.refunded`
- `order.delivered`

Nenhum provedor de e-mail fictício foi implementado.

## Tipos Supabase

`src/integrations/supabase/types.ts` foi atualizado com as estruturas e enums da Fase 10.

## Validação

Scripts:

- `scripts/validate-phase-10.mjs`
- `scripts/validate-phase-10-hardening.mjs`

Comando:

`npm run validate:phase10`

O comando executa o validador principal e, em seguida, o validador de hardening.

O validador de hardening foi executado isoladamente após a auditoria final e obteve **6/6 verificações aprovadas**.

A execução Work anterior informou sucesso do validador principal, regressões relevantes e build antes do hardening. Nesta sessão não foi possível repetir o build completo porque o ambiente local disponível não contém a árvore/dependências do repositório e não possui conectividade direta com o GitHub. As alterações posteriores ao build são SQL, script de validação e o comando de validação do `package.json`; nenhuma lógica runtime do frontend foi alterada nesta auditoria final.

## Aplicação remota pendente

Antes de declarar a Fase 10 encerrada no ambiente remoto, aplicar no Supabase, nesta ordem:

1. `20260902040000_phase_10_definitive_order_core.sql`
2. `20260902041000_phase_10_order_integrity_hardening.sql`

Não declarar aplicação remota até receber confirmação real de sucesso.

## Fase 11 antiga

**CANCELADA POR INCOMPATIBILIDADE COM O MODELO SOB ENCOMENDA.**

Novo escopo ainda não definido.

## Commits relevantes

- `617f95c07cd6aabb9d0387bfcd0613b166cc6898` — implementação principal da Fase 10 pelo Work.
- `35269aff73d88d2471ee983dc1fcffbe1ed3e39c` — hardening de idempotência/pagamento.
- `3f665877b5be607d032c98f76ac1ff645a3e118a` — validador do hardening.
- `8d587a78d82eb82d31220139eff6cb12c6ad90a8` — preservação explícita do toolchain original com o novo validator encadeado.

## Pendências para fechamento 100%

1. aplicar as duas migrations da Fase 10 no Supabase remoto;
2. confirmar que ambas concluíram sem erro;
3. validar a interface autenticada no staging depois que o schema remoto existir;
4. corrigir eventual incompatibilidade encontrada apenas no ambiente remoto.

Até esses passos, o código está pronto, mas a Fase 10 não deve ser rotulada como concluída em produção.
