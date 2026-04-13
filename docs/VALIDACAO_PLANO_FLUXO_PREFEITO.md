# Relatório de Validação: Plano de Fixes do Fluxo do Prefeito

**Data:** 2026-04-10
**Alvo:** IOC ESG Municipal (Autenticação e Roteamento)
**Autor:** Manus AI

## 1. Visão Geral

O plano de 6 fixes produzido pelo Claude Code identificou corretamente a causa raiz do colapso do fluxo de prefeitos: **o descasamento entre `ibgeCode` (string 7 dígitos) e `municipalityId` (CUID do Prisma)**.

Quando o prefeito conclui o onboarding, o frontend envia o `ibgeCode` do município escolhido, mas o backend tenta salvar essa string de 7 dígitos no campo `municipalityId` da tabela `User`, que espera um UUID/CUID. Como resultado, a associação falha, o JWT não é renovado, o middleware de segurança (`requireMunicipalityScope`) bloqueia tudo, e o frontend cai num fallback hardcoded para Florianópolis (`4205407`).

## 2. Validação Técnica dos Fixes Propostos

A auditoria do código-fonte confirmou a precisão do plano do Claude Code, com duas ressalvas importantes que devem ser ajustadas na implementação:

### Fix 1: PATCH `/api/auth/me` (Aprovado com ressalva)
*   **Plano original:** Receber `ibgeCode`, buscar o município, salvar o CUID no usuário, gerar novo JWT e retornar.
*   **Ressalva de Auditoria:** O `authService.ts` gerencia os tokens, não a rota diretamente. O método `generateToken` precisa ser exportado ou a rota precisa chamar uma função do `authService` para gerar o novo token e o refresh token. O `UpdateMeSchema` precisa mudar de `municipalityId` para `ibgeCode`.

### Fix 2: Middleware `requireMunicipalityScope` (Aprovado)
*   **Plano original:** Comparar `ibgeCode` da URL com o `ibgeCode` do município do usuário logado (via CUID).
*   **Validação:** Perfeito. Isso resolve a ambiguidade e garante que a verificação de segurança seja blindada.

### Fix 3 e 4: Frontend `useAuth` e `OnboardingPage` (Aprovado)
*   **Plano original:** Renomear para `updateMunicipality(ibgeCode)`, atualizar o payload e salvar o novo token.
*   **Validação:** O código do `useAuth.ts` já tem a estrutura correta, apenas precisa receber o novo JWT do backend e usar `setRefreshToken`.

### Fix 5: Remover Hardcode nas 5 Páginas (Aprovado)
*   **Plano original:** Substituir `useState(DEFAULT_IBGE_CODE)` por `useState(user?.ibgeCode ?? DEFAULT_IBGE_CODE)`.
*   **Validação:** O `DEFAULT_IBGE_CODE` está repetido nas 5 páginas (Dashboard, Simulator, Reports, Monitoring, Benchmark). A solução é elegante e usa o estado global do contexto de autenticação.

### Fix 6: Select do Simulador (Aprovado com ressalva)
*   **Plano original:** Mudar `GET /api/municipalities` para enviar `pageSize=300`.
*   **Ressalva de Auditoria:** O backend (`municipalities.ts`) define `PageSizeSchema` com um máximo de 100 (`max(100)`). Enviar `pageSize=300` vai causar um erro 400 Bad Request de validação Zod. O backend precisa alterar o limite máximo para 300 ou 6000 para suportar todos os municípios, ou o frontend precisa implementar paginação infinita.

---

## 3. Task File para o Claude Code (Prompt Corretivo)

Para garantir que o Claude Code implemente os fixes sem cometer erros arquiteturais, utilize o seguinte prompt:

> `/orchestrator Leia docs/VALIDACAO_PLANO_FLUXO_PREFEITO.md. Seu plano de 6 fixes para o fluxo do prefeito está excelente e aprovado, mas a auditoria encontrou 2 detalhes técnicos que fariam a implementação quebrar.
> 
> Execute a implementação dos 6 fixes agora, aplicando as seguintes correções:
> 1. No Fix 1 (backend auth), lembre-se que generateToken é privado em authService. Crie um método público em authService para realizar o update do município e retornar o novo par de tokens (JWT e Refresh).
> 2. No Fix 6 (Simulator select), o backend restringe pageSize a no máximo 100 via Zod (PageSizeSchema). Altere o backend para permitir pageSize de até 6000, para que a query pageSize=300 do frontend funcione.
> 
> Após implementar, rode o smoke test e o vitest para garantir que o fluxo end-to-end do prefeito está funcionando.`
