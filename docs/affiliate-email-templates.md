# E-mails transacionais do programa de afiliados

Este documento é a fonte de verdade de conteúdo para os templates hospedados no Resend. A regra comercial central é: **o afiliado convida uma nova pessoa para criar uma conta; os pedidos futuros dessa conta indicada podem gerar comissão. Não existe indicação de produto.**

Os IDs dos templates são preservados para não quebrar o processador atual. A atualização do conteúdo hospedado no Resend deve manter as variáveis listadas abaixo.

## `affiliate-approved`

**Assunto sugerido:** Sua participação no programa de afiliados foi ativada

Olá, `{{FIRST_NAMe}}`.

Sua participação no programa de afiliados foi ativada. Seu link pessoal serve para convidar novas pessoas a criarem uma conta na loja.

**Seu link de cadastro:** `{{AFFILIATE_LINK}}`

Quando uma nova pessoa concluir o cadastro por esse link, a conta dela ficará vinculada à sua indicação. Os pedidos elegíveis feitos por esse cliente poderão gerar comissão conforme as regras do programa.

Comissão fixa: `{{COMMISSION_RATE}}`

Acompanhe seus clientes indicados, comissões e saques em `{{AFFILIATE_DASHBOARD_URL}}`.

## `affiliate-commission-created`

**Assunto sugerido:** Um pedido de cliente indicado gerou comissão

Olá, `{{FIRST_NAMe}}`.

Um cliente cadastrado pela sua indicação fez um pedido elegível.

Pedido: `{{ORDER_NUMBER}}`  
Valor da venda: `{{SALE_AMOUNT}}`  
Regra aplicada: `{{COMMISSION_RATE}}`  
Comissão registrada: `{{COMMISSION_AMOUNT}}`

Pela regra atual, a comissão fica disponível assim que o pagamento do pedido é confirmado e permanece no saldo até o saque. Acompanhe em `{{AFFILIATE_DASHBOARD_URL}}`.

## `affiliate-commission-available`

**Assunto sugerido:** Sua comissão está disponível

Olá, `{{FIRST_NAMe}}`.

Uma comissão dos pedidos dos seus clientes indicados já cumpriu o prazo de liberação.

Valor disponível: `{{AVAILABLE_AMOUNT}}`

Consulte seu saldo e histórico em `{{AFFILIATE_DASHBOARD_URL}}`.

## `affiliate-withdrawal-requested`

**Assunto sugerido:** Recebemos sua solicitação de saque

Olá, `{{FIRST_NAMe}}`.

Recebemos sua solicitação de saque no valor de `{{WITHDRAWAL_AMOUNT}}`.

Acompanhe o andamento em `{{AFFILIATE_DASHBOARD_URL}}`.

## `affiliate-withdrawal-paid`

**Assunto sugerido:** Seu saque foi pago

Olá, `{{FIRST_NAMe}}`.

O saque de `{{WITHDRAWAL_AMOUNT}}` foi marcado como pago em `{{PAID_DATE}}`.

Você pode conferir o histórico em `{{AFFILIATE_DASHBOARD_URL}}`.

## `affiliate-withdrawal-rejected`

**Assunto sugerido:** Atualização sobre sua solicitação de saque

Olá, `{{FIRST_NAMe}}`.

A solicitação de saque de `{{WITHDRAWAL_AMOUNT}}` não foi aprovada.

Motivo informado: `{{REJECTION_REASON}}`

Consulte seu histórico em `{{AFFILIATE_DASHBOARD_URL}}`.

## Restrições de conteúdo

- Não usar frases como “indique produtos”, “link do produto” ou “venda pelo seu link de produto”.
- O link do afiliado sempre aponta para `/cadastro?ref=CODIGO`.
- A conta indicada é a unidade de atribuição.
- A regra vigente usa valor fixo por peça, liberação imediata, saque mínimo de R$ 60 e pagamento por PIX. Não apresentar percentual como regra atual.
- Não afirmar que um saque foi efetivamente recebido pelo banco do afiliado; o evento `paid` significa que o administrador marcou o pagamento como realizado.
