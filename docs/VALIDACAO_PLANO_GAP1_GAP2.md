# Relatório de Validação: Plano de Resolução GAP 1 e GAP 2

## 1. Avaliação Geral do Plano

O plano elaborado pelo Claude Code para resolver os gaps de produção (Nginx/SSL e Coletores Estáticos) é **pragmático, seguro e alinhado com as premissas de negócio**. 

A decisão arquitetural de manter os coletores lendo JSONs locais, mas criar scripts de atualização (`update-*-data.ts`), é **brilhante**. Como ele bem justificou:
1. Nenhuma API governamental brasileira tem SLA confiável para chamadas síncronas real-time.
2. O cálculo ODS continua respondendo em 1ms (leitura de memória).
3. O risco de falha em produção cai a zero, pois a fragilidade da API do governo fica isolada no script de atualização que roda em CI/CD ou manualmente.

No entanto, a auditoria no código-fonte encontrou **3 armadilhas técnicas críticas** que fariam a implementação quebrar se executada exatamente como planejada.

## 2. Armadilhas Identificadas no Plano

### Armadilha 1: Header HSTS no Nginx HTTP-only (GAP 2)
**O Problema:** O plano diz para copiar os headers de segurança do `nginx.conf` atual para o novo `nginx-http.conf`. Porém, o arquivo atual contém:
`add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`
**O Impacto:** Se o Nginx servir esse header via HTTP (porta 80), o navegador do usuário registrará o domínio na lista de HSTS. Se o SSL falhar ou for removido no futuro, o navegador bloqueará o acesso ao site para sempre, exigindo HTTPS.
**A Correção:** O Claude Code deve remover explicitamente o header `Strict-Transport-Security` do arquivo `nginx-http.conf`.

### Armadilha 2: Dependência do Python no IEPS (GAP 1)
**O Problema:** O plano diz para renomear `fetch-ieps-data.ts` para `update-ieps-data.ts`. A auditoria mostrou que o script atual na verdade **não é um script TypeScript funcional**, mas sim um comentário gigante contendo código Python (`import basedosdados as bd`) e instruções manuais do Google Cloud Platform (GCP).
**O Impacto:** Renomear o arquivo não o tornará executável. O comando `npx tsx scripts/update-ieps-data.ts` não fará nada.
**A Correção:** O Claude Code precisa reescrever o `update-ieps-data.ts` para ser um script TypeScript real que faz fetch na API GraphQL da Base dos Dados, ou criar um scraper em TypeScript, sem depender de Python ou GCP manual.

### Armadilha 3: Validação Zod Rígida (GAP 1)
**O Problema:** O plano propõe injetar o ano dinamicamente nos coletores: `const REFERENCE_YEAR = meta?.referenceYear ?? 2022`.
**O Impacto:** O arquivo `ieps_collector.ts` usa validação Zod estrita na inicialização do módulo (`IepsDataFileSchema.safeParse`). Se o schema Zod esperar chaves específicas ou formatos que mudem entre 2021 e 2024, o `.safeParse` falhará e o coletor retornará `null` para todos os municípios silenciosamente.
**A Correção:** O Claude Code deve garantir que os scripts de atualização gerem JSONs estritamente compatíveis com os Schemas Zod definidos em `shared/types/agents/`, atualizando os schemas se o formato da fonte governamental tiver mudado.

## 3. Task File Corretivo para o Claude Code

Para garantir o sucesso da implementação, envie o seguinte prompt ao Claude Code:

> **Prompt:**
> Excelente plano para os GAPs 1 e 2. A decisão de manter JSONs locais atualizados via script é pragmática e aprovada. No entanto, uma auditoria identificou 3 armadilhas no seu plano. Leia o documento `docs/VALIDACAO_PLANO_GAP1_GAP2.md` e execute a implementação aplicando as 3 correções exigidas (remover HSTS do HTTP-only, reescrever o script do IEPS em TS real, e garantir compatibilidade Zod nos novos JSONs). Pode iniciar a execução dos commits.
