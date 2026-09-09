# Coletor Google Photos - BIGofertas

O coletor percorre um album publico do Google Photos em navegador real (Chromium/Playwright), identifica o container interno de rolagem, percorre o album ate estabilizar, captura as imagens do catalogo em ordem visual e registra os URLs diretos servidos pelo Google.

## Saidas da coleta

- `collector.json`: relatorio completo com imagens, titulos, grupos, ordem visual e dados de auditoria.
- `groups.json`: grupos `titulo -> imagens` prontos para o normalizador do catalogo.
- `direct-image-urls.txt`: URLs exatamente observadas no Google Photos.
- `high-quality-image-urls.txt`: os mesmos arquivos solicitados em alta resolucao (`w4096-h4096-s-no-gm`).
- `page-final.png`: captura de diagnostico da ultima tela carregada.

O coletor separa midias de interface/capa das imagens reais do catalogo usando posicao no album e dimensoes visuais. Titulos duplicados pelo DOM do Google Photos sao consolidados antes do agrupamento.

## Assimilacao visual automatica

Depois da coleta, `scripts/google-photos-assimilator.mjs` transforma cada grupo em material visual que o assistente pode revisar sem depender de prints enviados manualmente pelo usuario.

Saidas adicionais em `assimilation/`:

- `overview.png`: painel completo do lote, com titulo e ate cinco imagens por grupo;
- `contact-sheets/*.png`: um screenshot individual para cada titulo/produto encontrado;
- `contact-sheets/*.html`: versao HTML auditavel de cada contact sheet;
- `assimilation.json`: metadados, contagens, caminhos dos screenshots e proposta estrutural de cada grupo;
- `catalog-proposals.json`: produtos-base propostos e seus grupos/versoes;
- `assimilation.md`: resumo humano para auditoria rapida.

O parser estrutural propoe automaticamente tipo, time/selecao, temporada, marca, modelo I/II/III, versao Torcedor/Jogador e publico. Inferencias sao marcadas explicitamente e nao substituem revisao visual quando houver ambiguidade.

A regra continua conservadora: se alguma imagem de produto ficar sem titulo, a coleta falha. Se alguma imagem nao carregar no contact sheet, a assimilacao visual tambem falha. `scripts/google-photos-assimilator-runner.mjs` repete a assimilacao ate tres vezes para absorver falhas transitorias de carregamento do Google; so considera o lote valido quando a tentativa final tem zero imagens quebradas.

## Operacao sem prints do usuario

O fluxo pode ser executado sem upload manual de prints:

1. o assistente encontra o link do album no PDF/catalogo-fonte;
2. cria uma branch temporaria com nome `catalog-google-photos-*` baseada na `main`;
3. cria `catalog-jobs/google-photos/job.json` nessa branch;
4. o push dispara automaticamente o workflow;
5. o workflow coleta o album, gera URLs, `overview.png` e contact sheets;
6. o assistente baixa o artifact e revisa visualmente os grupos;
7. somente casos realmente ambiguos exigem print/manual review.

Formato do job:

```json
{
  "album_url": "https://photos.google.com/share/...",
  "label": "TOP 10 LANCAMENTOS",
  "expected_min_images": 50,
  "max_scrolls": 220
}
```

O workflow tambem continua disponivel por `workflow_dispatch` para execucao manual.

## Prova real - Top 10 Lancamentos

A coleta base foi validada no album real `[26/27] TOP 10 LANÇAMENTOS DO ANO`: 55 midias Google observadas, 5 midias de interface/capa descartadas, 50 imagens de produto mantidas, 10 titulos consolidados, 10 grupos, 5 imagens em cada grupo e 0 imagens sem titulo.

A camada de assimilacao visual foi validada inicialmente no workflow run `34370379605`: 10 contact sheets gerados, `overview.png` com as 50 imagens, 50/50 imagens carregadas, 0 falhas visuais e 10 produtos-base propostos. A revisao visual do overview confirmou Chelsea I, Chelsea II, Manchester City II, Bayern I, Bayern II, Barcelona II, PSG I, Lyon II, Milan II e Napoli I, todos com cinco imagens.

O fluxo autonomo por branch/job foi validado novamente no workflow run `34371627604`: a branch `catalog-google-photos-top10-smoke-2` disparou a coleta apenas pela criacao de `job.json`; o resultado final teve 50 imagens de produto, 10 grupos, 10 contact sheets, 50/50 imagens no overview, 0 falhas visuais e workflow concluido com sucesso.

## Execucao local

```bash
npm install --no-save playwright
npx playwright install chromium
node scripts/google-photos-collector.mjs \
  --url "https://photos.google.com/share/..." \
  --label "TOP 10 LANCAMENTOS" \
  --expected-min-images 50

node scripts/google-photos-assimilator-runner.mjs \
  --input .artifacts/google-photos-collector/collector.json \
  --out .artifacts/google-photos-collector/assimilation
```

## Estado

Coleta e assimilacao visual automatica concluidas. O usuario nao precisa mais enviar prints como regra geral; prints passam a ser excecao para casos ambiguos. A proxima camada independente e o normalizador/cadastro: transformar a proposta revisada em produto-base/variacoes/descricao/P000XXX e gravar no Supabase.

## Seguranca

O coletor aceita apenas URLs HTTPS de `photos.google.com` ou `photos.app.goo.gl`. A coleta e somente leitura: nao apaga, altera ou envia arquivos ao Google Photos. O job de catalogo contem apenas URL publica e parametros operacionais; nenhuma credencial do Google e armazenada no repositorio.
