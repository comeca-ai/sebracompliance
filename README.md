# sebracompliance

PoC Fase 1 da Mesa de Integridade do SEBRAE/RO (Termo de Referência, Unidade de Integridade Corporativa).

Cloudflare Worker. GitHub Actions faz o deploy em cada push em `main`.

## Rotas

- `/` mesa de contratos (aprovação humana obrigatória)
- `/painel` indicadores, matriz 5×5, tarefas, catálogo normativo
- `/terceiros` screening mínimo (Transparência, OpenSanctions, sanções)
- `/canal` denúncia com anonimato opcional
- `/relatorio` 69 itens de segurança do TR
- `/api/contratos` `/api/seguranca` `/api/terceiros` `/health` `/openapi.json`

DEMO. Amostra estática. Sem SGF, sem LLM, sem dado de produção.

## Secrets do Actions

`CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
