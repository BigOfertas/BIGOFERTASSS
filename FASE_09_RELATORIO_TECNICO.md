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

A documentação atual da SuperFrete também informa que a disponibilidade da Loggi é controlada pela configuração do token e depende de ponto de postagem próximo ao CEP de origem. O código, portanto, trata ausência da Loggi como indisponibilidade real e não inventa alternativa.

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
- microinterações suaves;
- checkout continua desabilitado nesta fase.

## Produção versus transporte

O prazo comercial da BIGofertas continua separado do prazo da transportadora.

Produção:

**até 5 dias úteis antes do envio**.

Transporte:

**prazo real retornado pela SuperFrete para a modalidade escolhida**.

O frontend informa explicitamente que o prazo de transporte começa depois da produção. O valor `delivery_time` do provedor nunca é adulterado para incorporar produção.

## Integração com a Fase 10

Não foi necessária nova migration para pedidos.

A Fase 10 já criou campos de snapshot para:

- provedor;
- serviço;
- referência de cotação;
- valor-base;
- adicional;
- total do frete;
- prazo de transporte;
- data da cotação;
- rastreio.

O futuro checkout deverá recalcular o frete no backend imediatamente antes de criar o pedido/pagamento e gravar o snapshot definitivo. A cotação selecionada no navegador nunca será considerada autoridade financeira.

## Pagamento

A Fase 09 não implementa pagamento.

A decisão futura já definida é manter carrinho/endereço/frete/revisão na BIGofertas e usar checkout hospedado da InfinitePay para a etapa final de pagamento.

## Estoque

Nenhuma lógica de estoque foi criada.

A cotação considera somente produtos comercialmente ativos, quantidade do carrinho e peso/dimensões de envio. Não existe reserva, baixa ou disponibilidade por quantidade física.

## Validação

Script:

- `scripts/validate-phase-09.mjs`

Comando:

`npm run validate:phase9`

O validador verifica estaticamente:

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
- ausência de preços fictícios no frontend.

## Pendências para encerramento oficial

1. confirmar build/deploy da `main` no Cloudflare;
2. confirmar que `/api/shipping/quote` está ativo no Worker;
3. quando houver produto real ativo no carrinho, executar uma cotação real e confirmar retorno das modalidades habilitadas no token;
4. se Loggi não for retornada, verificar somente a configuração Loggi/ponto de postagem do token, sem criar fallback fictício.

Não declarar a Fase 09 oficialmente encerrada até o deploy/runtime estar validado.
