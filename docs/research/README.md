# Pesquisa Fundacional — IOC ESG Municipal

> **Natureza:** material histórico. Contexto de origem das decisões do projeto.
> **Não é instrução ativa** — não substitui código, regras, ADRs nem estado atual.

## O que está aqui

Documentos de pesquisa, análise e metodologia produzidos antes ou durante a
fase de transição do projeto. Preservam o **racional** por trás de escolhas
que hoje vivem no código, mas que não ficam evidentes só lendo os arquivos
implementados.

## O que NÃO está aqui

- Estado atual do projeto → `docs/ESTADO_ATUAL_SC.md`
- Instruções operacionais → `CLAUDE.md`, `.claude/rules/`
- Decisões arquiteturais vigentes → `docs/decisions/` (ADRs)
- Planos ativos → `docs/plans/`
- Evidências de execução → `docs/evidence/`
- Runbook de produção → `docs/RUNBOOK_PRODUCAO.md`

## Estrutura

| Subdiretório      | Conteúdo                                                      |
| ----------------- | ------------------------------------------------------------- |
| `ux-ui-pesquisa/` | Pesquisa original de UX/UI e análise de inovação frontend     |
| `dados-fontes/`   | Mapeamento de fontes governamentais e guia técnico de APIs    |
| `metodologia/`    | Framework agêntico ESG, metodologia FPM, guia ODS+indicadores |

## Regras de uso

- **Somente leitura.** Se um documento aqui descreve algo que diverge do
  código atual, o código vence. Atualize o documento apenas se agregar
  contexto histórico, nunca para sincronizar com o estado vivo.
- **Não referenciar em decisões operacionais.** Se uma decisão atual precisa
  desse raciocínio, promova-o para ADR em `docs/decisions/` citando o arquivo
  fonte aqui.
- **Não expandir.** Novos materiais de pesquisa devem entrar em
  `docs/decisions/` (se viram decisão) ou `docs/plans/` (se viram plano).
  `docs/research/` fica congelado como registro fundacional.

## Auditoria

Arquivos migrados da antiga pasta `@transicao/` em `2026-04-16` como parte
do saneamento pós-bundle P0 da arquitetura Claude Code. Ver commit que
arquivou este conteúdo para rastreabilidade.
