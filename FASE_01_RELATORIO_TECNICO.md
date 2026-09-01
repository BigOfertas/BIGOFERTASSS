# BIGofertas — Fase 01 — Relatório técnico de saneamento

Data do pacote: 31/08/2026

## Status

Este é um **pacote candidato para validação da Fase 01**. A fase não foi marcada como formalmente aprovada. Nenhuma etapa de build/deploy para Hostinger foi antecipada.

## Base auditada

- O ZIP recebido foi lido integralmente: 155 entradas, 134 arquivos, 133 arquivos UTF-8 e 1 arquivo binário.
- A integridade do ZIP original foi validada sem erro.
- O código, migrations, assets-descriptor, arquivos de configuração e planos históricos do projeto foram preservados e auditados.

## Saneamentos executados

### Produtos fictícios e catálogo

- Removidos os arrays de produtos mockados das vitrines da Home.
- As vitrines passaram a consultar somente produtos existentes na tabela `products`.
- Removidos IDs hardcoded usados para simular produtos reais.
- Criada proteção central contra o seed fictício conhecido `Camisa Profissional BIGofertas 2024`.
- Criada migration de limpeza para remover esse seed do banco sem reescrever a migration histórica já existente.
- Carrinhos locais antigos também deixam de reapresentar esse seed conhecido.

### Busca e filtros

- A busca do Header agora envia de fato o texto digitado para `/products`.
- `/products` agora aceita `q` e pesquisa nome, descrição, categoria, campeonato, liga e time.
- Busca e filtros normalizam acentos, caixa, espaços e hífens.
- Removidos preenchimentos artificiais de campeonato/liga/time que faziam qualquer produto parecer pertencer ao Brasileirão/Série A/Flamengo.
- Filtros de categoria, campeonato, liga e time passam a operar sobre dados reais disponíveis.

### Links e navegação

- Removidas rotas inexistentes como `/brasileirao`, `/categoria/...` e `/times/...`.
- Links de categorias e times agora levam a `/products` com filtros válidos.
- Busca, conta, carrinho e menu mobile do Header foram ligados a rotas reais.
- Rodapé deixou de usar `href="#"` e ficou apenas com destinos existentes.
- Link de WhatsApp foi normalizado.
- Cartões de produto deixaram de exibir ações sem implementação.

### Metadata e identidade básica

- Removidos título/descrição/autoria padrão do Lovable.
- Documento raiz alterado para `pt-BR`.
- Metadata básica passou a usar BIGofertas.
- Favicon padrão do template foi substituído por um favicon básico da BIGofertas.
- Fallbacks de erro foram traduzidos para português.

### Frete e checkout fictícios

- Removidos frete fixo, regra de frete grátis, cupom/desconto mock e cálculo de total baseado nesses valores.
- O carrinho mostra apenas subtotal/total estimado e informa que o frete não está incluído.
- O checkout fictício/alerta foi removido; a finalização permanece desabilitada até as fases próprias de frete/pedidos/pagamento.

### Tipagem e configuração

- Removidos `any` explícitos do código autoral tocado nesta fase.
- Criados tipos compartilhados baseados no tipo gerado da tabela `products`.
- Centralizada a consulta do catálogo em `useCatalogProducts`.
- Cliente Supabase do frontend deixou de conter URL/chave pública hardcoded e passou a usar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Adicionado `.env.example` e `.gitignore` atualizado para não versionar `.env`.

### Conteúdo provisório

- Removida a FAQ provisória com alegações ainda não implementadas/validadas.
- Removidos placeholders visuais de banners e produtos.
- Removidos textos comerciais não comprovados, selos/garantias simulados e mensagens internas de “próximas fases” da interface.
- Seções sem dados reais agora não inventam conteúdo para preencher espaço.

## Validações executadas

- Integridade do ZIP original: OK.
- 87 arquivos TypeScript/TSX analisados sintaticamente: 0 erros de parser.
- JSON/TOML: 0 erros de parse.
- Imports relativos e aliases locais: 0 referências quebradas encontradas.
- Rotas literais internas: 0 destinos desconhecidos encontrados.
- Varredura por mocks/fakes/placeholders/rotas antigas/frete fictício: sem resíduos no runtime; as únicas referências a `placehold.co` são a migration histórica, a migration de remoção e a proteção que identifica o seed fictício.
- Testes isolados de busca/filtros: acentos, hífens, múltiplos termos, rejeição de termo inexistente e bloqueio do seed fictício passaram.

## Limitações da validação neste ambiente

O ZIP não contém `node_modules`. A instalação das dependências não pôde ser concluída neste ambiente, portanto:

- `npm run build` não executou porque `vite` não está instalado localmente.
- `npm run lint` não executou porque `eslint` não está instalado localmente.

Isso não foi tratado como aprovação de build. O pacote deve ser validado novamente após `npm install` em um ambiente com acesso às dependências.

A migration de limpeza foi adicionada ao projeto, mas não foi aplicada ao Supabase remoto a partir deste ambiente.

## Itens deliberadamente não antecipados

- Modelagem definitiva de produtos (Fase 02).
- Migração/normalização de imagens no Cloudflare R2 (Fase 03). Os descriptors de assets existentes continuam preservados.
- Catálogo completo/paginação/ordenação definitiva (Fase 04).
- Variantes/tamanhos/estoque final do produto (Fases 02/05/06/11).
- Frete real (Fase 09).
- Pedidos, InfinitePay, checkout final e webhook (Fases 10–14).
- SEO/performance/a11y completos (Fase 19).
- Auditoria final de segurança (Fase 20).
- Build específico da Hostinger (Fase 21).
- Deploy/produção (Fases 22–23).
