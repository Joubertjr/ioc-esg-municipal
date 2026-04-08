# PROTOCOLO OBRIGATÓRIO DE TESTES E EVIDÊNCIAS (Claude Code)

> **ATENÇÃO CLAUDE CODE:** Este documento não é uma sugestão. É um protocolo estrito de "Classe Mundial". Você já falhou anteriormente ao gerar evidências temporárias e ao não commitar screenshots de mudanças visuais. Leia e siga milimetricamente.

---

## 1. A REGRA INVIOLÁVEL DOS SCREENSHOTS

Em um projeto de Classe Mundial, **não existe mudança visual sem prova visual**. 

Se você alterou **qualquer** arquivo de UI (componente React, CSS, Tailwind classes, HTML), você está **PROIBIDO** de considerar a tarefa concluída ou pedir aprovação do usuário sem antes commitar screenshots do resultado.

**A REGRA É BINÁRIA:**
- Alterou UI? → **OBRIGATÓRIO** tirar screenshot e commitar.
- Não tem screenshot no commit? → O trabalho **NÃO FOI FEITO** e será rejeitado.

---

## 2. COMO GERAR E SALVAR EVIDÊNCIAS VISUAIS

Sempre que alterar UI, siga este fluxo exato ANTES de pedir aprovação:

1. **Criar a pasta de evidências com a data e nome da feature:**
   ```bash
   mkdir -p docs/evidence/$(date +%Y-%m-%d)-nome-da-feature
   ```

2. **Gerar a evidência visual (Screenshots):**
   - Suba o frontend localmente.
   - Abra no Chrome DevTools em modo Mobile (ex: iPhone 14 Pro - 390px de largura).
   - Tire screenshots do Light Mode e Dark Mode.
   - Salve **dentro** da pasta criada acima (ex: `docs/evidence/2026-04-07-nome-da-feature/mobile-light.png`).

3. **Gerar o Relatório (REPORT.md):**
   - Crie `docs/evidence/$(date +%Y-%m-%d)-nome-da-feature/REPORT.md`.
   - Liste as mudanças feitas.
   - Inclua os links markdown para as imagens salvas.

4. **Commitar e fazer Push (OBRIGATÓRIO):**
   ```bash
   git add docs/evidence/
   git commit -m "docs(evidence): screenshots da feature X"
   git push origin main
   ```

---

## 3. PROTOCOLO DE TESTES (Design-First)

### 3.1. Frontend (React Testing Library + Vitest)
Nenhum componente novo pode ser mesclado sem testes de renderização.
**Onde salvar:** `frontend/src/components/[pasta]/__tests__/[Componente].test.tsx`
**Critérios Mínimos:**
- O componente renderiza sem quebrar?
- Acessibilidade: elementos interativos têm ARIA labels? Cores de status têm fallback semântico?
- O console do teste deve estar LIMPO (zero warnings do React ou bibliotecas como Recharts).

### 3.2. Lógica de Negócio (Mappers ODS)
A conversão de dados brutos para ODS Score é a parte mais crítica do sistema.
**Onde salvar:** `tests/unit/agents/[agente]_ods_mapper.test.ts`
**Critérios Mínimos:**
- Dado bruto da API X → deve resultar no Score Y exato.
- Tratamento de valores nulos, ausentes ou zeros.
- Valores de fronteira (boundary values).

---

## 4. CHECKLIST DE PRÉ-COMMIT (Leia antes de TODO push)

Antes de rodar `git push`, pare e responda mentalmente:

1. [ ] Eu alterei a UI? Se sim, os arquivos `.png` estão na pasta `docs/evidence/`?
2. [ ] O `REPORT.md` está junto com as imagens explicando o que mudou?
3. [ ] Os testes rodaram limpos (`pnpm test`), sem warnings no console?
4. [ ] O TypeScript compilou sem erros (`npx tsc --noEmit`)?
5. [ ] Eu fiz o `git add` da pasta `docs/evidence/`?

**Se qualquer resposta for NÃO, cancele o push. Corrija o problema. Só faça push quando tudo for SIM.**
