# BIGofertas

E-commerce esportivo desenvolvido com React 19, TanStack Start/Router, Supabase, Tailwind CSS v4 e infraestrutura de imagens preparada para Cloudflare R2.

## Desenvolvimento local

Requisitos: Node.js 22+ e npm.

```sh
npm install
npm run dev
```

Validações estruturais disponíveis:

```sh
npm run validate:phase2
npm run validate:phase3
npm run validate:phase4
npm run validate:phase5
npm run validate:phase6
npm run lint
npm run build
```

## Variáveis

O frontend usa as variáveis públicas `VITE_SUPABASE_*` e `VITE_R2_PUBLIC_BASE_URL`.

As credenciais de escrita do R2 **nunca pertencem ao frontend**. Elas ficam somente nas Supabase Edge Functions; consulte `supabase/functions/.env.example` e `cloudflare/README-R2.md`.

## Estado do projeto

Este pacote é cumulativo e contém as **Fases 01 a 06**.

- Fase 01: saneamento da base atual.
- Fase 02: modelagem definitiva dos produtos, opções, variantes e estoque estrutural.
- Fase 03: infraestrutura Cloudflare R2 preparada para receber imagens, sem carga definitiva.
- Fase 04: catálogo escalável com busca, filtros, índices e paginação no banco.
- Fase 05: página final do produto preparada para galeria, opções, variantes e SEO.
- Fase 06: carrinho definitivo com linhas por variante, migração de carrinhos antigos, recuperação de dados inválidos e validação read-only de preço/estoque.

A carga definitiva dos 1.000+ produtos e de todas as imagens continua deliberadamente adiada para perto do final do projeto.

A conexão com o novo Supabase de staging também não foi gravada neste pacote. Depois da Fase 06, o backend deve ser conectado e as migrations cumulativas aplicadas antes da Fase 07.

O pacote específico para Hostinger continua reservado para a fase de build estático/deploy.
