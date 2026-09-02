# FASE 09 — Frete Real

Data técnica: 2026-09-02

## Status

**Implementação de código concluída; validação de deploy/runtime pendente.**

A Fase 09 integra a BIGofertas à API real de cotação da SuperFrete sem implementar checkout provisório, pagamento ou dados fictícios.

O token de produção foi gerado pelo proprietário e cadastrado no Cloudflare Worker como secret `SUPERFRETE_TOKEN`. O valor do token não é armazenado no repositório nem enviado ao frontend.

## Regras comerciais definitivas

Serviços aprovados:

- Correios PAC;
- Correios SEDEX;
- Loggi.

Nenhuma outra modalidade retornada pela plataforma deve ser exibida.

### Origens

Correios PAC/SEDEX:

- CEP de origem: `59655-000` — Areia Branca/RN.

Loggi:

- CEP de origem: `59630-508` — Mossoró/RN.

As cotações são executadas separadamente por origem para impedir que um serviço utilize acidentalmente o CEP operacional do outro.

### Adicionais BIGofertas

Correios PAC e SEDEX:

`valor cobrado = cotação real do transporte + R$ 10,00`

Loggi:

`valor cobrado = cotação real do transporte + R$ 30,00`

O código mantém valor-base, adicional e total separados. O adicional é aplicado uma vez à cotação total do pedido.

## Desconto progressivo e frete grátis

Regra comercial vigente, revisada pelo cliente em 2026-09-02 e baseada na quantidade total de peças do carrinho/pedido:

- 5 a 7 peças: 5% de desconto;
- 8 a 14 peças: 10% de desconto + frete grátis;
- 15 a 24 peças: 15% de desconto + frete grátis;
- 25 a 34 peças: 20% de desconto + frete grátis;
- 35 ou mais peças: 30% de desconto + frete grátis.

Portanto, **o frete é grátis para o cliente a partir de 8 peças**, independentemente da faixa de desconto superior atingida depois disso.

O carrinho exibe a faixa atual, a próxima meta, o desconto estimado e o benefício de frete grátis quando aplicável.

A autoridade financeira não fica no navegador. A migration `20260902153000_progressive_discount_and_free_shipping.sql` introduz o cálculo autoritativo e os snapshots; a migration incremental `20260902154500_progressive_discount_revision.sql` substitui os degraus comerciais pela regra vigente acima sem reescrever migration anterior.

Quando há frete grátis, a cotação real da transportadora e o adicional BIGofertas continuam preservados para a operação interna, enquanto `shipping_discount_amount` absorve integralmente esse custo e `shipping_amount` fica em zero para o cliente.

## Embalagem operacional

Regra prática aprovada pelo proprietário:

- comprimento: 40 cm;
- largura: 28 cm;
- altura: 5 cm;
- capacidade: até 3 camisas por volume;
- peso conservador da embalagem: 200 g;
- peso conservador por camisa quando o produto não possuir peso real cadastrado: 300 g.

Quando existir `weight_grams` real e ele for superior ao padrão conservador, o peso real maior prevalece.

O frontend nunca informa o peso a ser confiado. O backend consulta os produtos ativos no Supabase e calcula o peso de cotação com dados confiáveis.

### Mais de três camisas

Para pedidos com mais de três unidades é utilizada uma aproximação conservadora e deliberadamente favorável a não subestimar o frete:

1. `quantidade de volumes = ceil(total de camisas / 3)`;
2. cada volume é cotado com a embalagem 40×28×5;
3. o peso representativo usa até três unidades com o maior peso unitário do carrinho mais 200 g de embalagem;
4. o valor-base retornado para um volume é multiplicado pela quantidade de volumes;
5. o adicional fixo BIGofertas é somado uma única vez.

A estratégia é centralizada em `SHIPPING_CONFIG`, permitindo substituição futura por empacotamento mais preciso sem alterar o restante do checkout.

## Integração SuperFrete

Endpoint de produção utilizado:

`POST https://api.superfrete.com/api/v0/calculator`

Autenticação:

- `Authorization: Bearer <secret>`;
- `User-Agent` identificando a BIGofertas e contato técnico.

IDs de serviço usados/aceitos:

- PAC: `1`;
- SEDEX: `2`;
- Loggi: `31`.

A disponibilidade da Loggi depende da configuração do token/ponto de postagem. O código trata ausência da Loggi como indisponibilidade real e não inventa alternativa.

## Backend seguro

Arquivo principal:

- `src/lib/shipping-server.ts`

Rota interceptada no Worker:

- `POST /api/shipping/quote`

Integração no entrypoint:

- `src/server.ts`

Proteções implementadas:

- token lido somente de `env.SUPERFRETE_TOKEN`;
- nenhuma variável `VITE_` para o token;
- somente POST;
- rejeição de origem cruzada quando o header `Origin` estiver presente;
- CEP normalizado e validado em 8 dígitos;
- IDs de produto validados;
- quantidade por item validada;
- corpo limitado;
- produtos e pesos revalidados no Supabase;
- somente produtos ativos participam da cotação;
- respostas com `Cache-Control: no-store`;
- serviços retornados são filtrados para PAC, SEDEX e Loggi;
- falha de uma transportadora não derruba obrigatoriamente as demais modalidades disponíveis;
- nenhum preço ou prazo fallback fictício.

## Frontend

Arquivos:

- `src/lib/shipping.ts`;
- `src/lib/progressive-discount.ts`;
- `src/components/cart/ShippingCalculator.tsx`;
- `src/routes/cart.tsx`.

Experiência no carrinho:

- campo de CEP com máscara;
- botão para calcular/recalcular;
- loading skeleton;
- erro contextual;
- cartões selecionáveis de PAC, SEDEX e Loggi quando realmente disponíveis;
- valor final real da modalidade;
- prazo real de transporte retornado pelo provedor;
- seleção automática inicial da opção mais barata;
- total estimado atualizado com o frete selecionado;
- informação de múltiplos volumes quando aplicável;
- desconto progressivo automático por quantidade;
- indicador visual da próxima faixa de desconto;
- frete grátis visível a partir de 8 peças, mantendo a cotação operacional real;
- microinterações suaves e suporte a `prefers-reduced-motion`;
- checkout continua desabilitado nesta fase.

## Produção versus transporte

O prazo comercial da BIGofertas continua separado do prazo da transportadora.

Produção:

**até 5 dias úteis antes do envio**.

Transporte:

**prazo real retornado pela SuperFrete para a modalidade escolhida**.

O frontend informa explicitamente que o prazo de transporte começa depois da produção. O valor `delivery_time` do provedor nunca é adulterado para incorporar produção.

## Integração com a Fase 10

A Fase 10 já criou os snapshots principais de frete. A regra comercial de desconto progressivo usa migrations incrementais adicionais:

- `20260902153000_progressive_discount_and_free_shipping.sql`;
- `20260902154500_progressive_discount_revision.sql`.

Elas mantêm:

- `orders.discount_percent`;
- `orders.shipping_discount_amount`;
- função determinística para as faixas de desconto;
- cálculo autoritativo no núcleo do pedido;
- preservação do custo real do frete mesmo quando o cliente recebe frete grátis;
- regra vigente de frete grátis a partir de 8 peças.

O futuro checkout deverá recalcular o frete no backend imediatamente antes de criar o pedido/pagamento e gravar o snapshot definitivo. A cotação selecionada no navegador nunca será considerada autoridade financeira.

## Pagamento

A Fase 09 não implementa pagamento.

A decisão futura já definida é manter carrinho/endereço/frete/revisão na BIGofertas e usar checkout hospedado da InfinitePay para a etapa final de pagamento.

O rodapé público possui uma faixa visual de formas de pagamento e segurança sem selos externos fictícios. Ela referencia PIX, Visa, Mastercard, Elo e American Express como meios planejados via InfinitePay, além de HTTPS e proteção de acesso do próprio site.

## Estoque

Nenhuma lógica de estoque foi criada.

A cotação considera somente produtos comercialmente ativos, quantidade do carrinho e peso/dimensões de envio. Não existe reserva, baixa ou disponibilidade por quantidade física.

## Validação

Scripts:

- `scripts/validate-phase-09.mjs`;
- `scripts/validate-progressive-discount.mjs`.

Comandos:

- `npm run validate:phase9`;
- `npm run validate:pricing`.

Os validadores verificam estaticamente:

- segredo somente no Worker;
- API real de produção;
- Bearer e User-Agent;
- origens corretas;
- IDs das modalidades aprovadas;
- adicionais de R$10/R$30;
- embalagem 40×28×5;
- 200 g de embalagem;
- fallback conservador de 300 g por camisa;
- máximo de 3 camisas por volume;
- peso confiável consultado no backend;
- separação das cotações por origem;
- separação entre produção e transporte;
- integração real no carrinho;
- ausência de preços fictícios no frontend;
- faixas exatas 5/8/15/25/35;
- percentuais exatos 5/10/15/20/30;
- frete grátis em todas as faixas a partir de 8 peças;
- cálculo autoritativo no backend;
- ausência de Reclame Aqui e de selo Google Site Seguro inventado no rodapé.

## Pendências para encerramento oficial

1. aplicar `20260902153000_progressive_discount_and_free_shipping.sql` no Supabase real se ainda não tiver sido aplicada;
2. aplicar `20260902154500_progressive_discount_revision.sql` no Supabase real;
3. confirmar build/deploy da `main` no Cloudflare;
4. confirmar que `/api/shipping/quote` está ativo no Worker;
5. quando houver produto real ativo no carrinho, executar uma cotação real e confirmar retorno das modalidades habilitadas no token;
6. se Loggi não for retornada, verificar somente a configuração Loggi/ponto de postagem do token, sem criar fallback fictício.

Não declarar a Fase 09 oficialmente encerrada até o deploy/runtime e as migrations incrementais aplicáveis estarem validados.
