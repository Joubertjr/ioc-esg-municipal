# Validação: Smoke Test Stack (Commit 00e352a)

**Data:** 2026-04-10
**Alvo:** `scripts/smoke-test-stack.sh`
**Autor:** Manus AI

## Resumo da Auditoria

O script `smoke-test-stack.sh` criado pelo Claude Code é uma adição valiosa para a estabilidade do projeto, servindo como um "teste de sanidade" rápido antes de aprovar PRs ou deploys. A auditoria confirmou que os bugs reportados (como o `/api/ods` com rota errada e o erro de contagem de municípios) foram efetivamente corrigidos na API para que o teste passasse.

No entanto, a auditoria revelou **oportunidades de melhoria contínua** na qualidade e robustez do próprio script, que atualmente possui falsos positivos e validações superficiais.

---

## 1. O que foi bem feito (Aprovado)

*   **Cobertura E2E Real:** O script testa o fluxo real que o usuário percorre (Health → Frontend SPA → Login JWT → Lista → Detalhe → Scores → Peers → Benchmark).
*   **Modos Flexíveis:** Suporta `dev` (portas 3000/5173) e `prod-local` (porta 8080 unificada), facilitando o uso local.
*   **Correção de Bugs Comprovada:** O script forçou a correção da rota `/api/municipalities/:id/ods` (que não existia) para a rota correta `/api/ods/:ibgeCode`, além de corrigir o endpoint de benchmarks.
*   **Parsing Robusto:** O uso de `python3 -c "import json..."` embutido no bash previne erros de parse com `jq` ausente ou quebrado no ambiente.

---

## 2. Oportunidades de Melhoria (Falsos Positivos e Fragilidades)

A auditoria do código-fonte do script revelou os seguintes problemas:

### 2.1. Validação Superficial (Falso Positivo de Sucesso)
Nos testes 6 (ODS Scores), 7 (Peers) e 8 (Benchmark), o script verifica **apenas o HTTP Status Code 200**:
```bash
if [ "$http" = "200" ]; then
  pass "6. GET /api/ods/4205407 (HTTP $http)"
```
Is point, se a API retornar `200 OK` com um array vazio `[]` ou um objeto nulo `{}`, o teste passará, mesmo que o banco de dados esteja corrompido ou os mappers tenham falhado. O teste deve validar a existência de campos-chave (ex: `score_geral` no teste 6).

### 2.2. Credenciais Hardcoded e Inflexíveis
As credenciais de teste estão fixas no topo do arquivo:
```bash
EMAIL="admin@ioc.local"
PASSWORD="Admin@2026"
```
Se o banco de dados de dev/prod-local tiver senhas diferentes (ou se for executado contra um ambiente de staging), o teste falhará no Passo 3 e abortará todos os passos seguintes que dependem do Token JWT. Deve suportar variáveis de ambiente `SMOKE_TEST_EMAIL` e `SMOKE_TEST_PASSWORD`.

### 2.3. Falta de Integração CI/CD
O script foi criado e executado manualmente, mas **não foi adicionado ao `.github/workflows/main.yml`**. Um smoke test só é verdadeiramente útil se rodar automaticamente a cada pull request.

### 2.4. Teste de IDOR Ausente
O script testa um login de `admin` e acessa dados. Como o projeto acabou de implementar um middleware `requireMunicipalityScope` crítico contra IDOR, o smoke test deveria testar o login de um *prefeito* tentando acessar dados de *outro município* para garantir que o middleware retorna `403 Forbidden`.

---

## 3. Task File de Melhoria Contínua

*(Este bloco deve ser fornecido ao Claude Code para refatorar o script)*

```markdown
# TASK: Evolução do Smoke Test Stack

**Objetivo:** Aumentar o rigor e a utilidade do `smoke-test-stack.sh` no pipeline de CI/CD.

**Critérios de Aceite:**

1. **Aprofundar Validação:** Nos testes 6, 7 e 8, não verifique apenas `HTTP 200`. Use o parse em Python para garantir que a resposta contém dados reais (ex: verificar se o ODS 3 tem um score numérico, ou se a lista de peers tem `length > 0`).
2. **Credenciais Injetáveis:** Permita que `EMAIL` e `PASSWORD` sejam sobrescritos via variáveis de ambiente, mantendo os valores atuais apenas como fallback padrão.
3. **Integração CI/CD:** Adicione a execução do `scripts/smoke-test-stack.sh dev` no final do job `ci` no `.github/workflows/main.yml` (logo após os testes do vitest).
4. **Teste de IDOR (Novo):** Adicione um "Teste 10": Faça login com um usuário restrito (prefeito de município A) e tente dar GET em `/api/ods/municipio_B`. O teste deve exigir que a resposta seja `403 Forbidden`.
```
