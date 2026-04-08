# PROTOCOLO OBRIGATÓRIO DE TESTES E EVIDÊNCIAS (Claude Code)

> **ATENÇÃO CLAUDE CODE:** Este documento não é uma sugestão. É um protocolo estrito. Você falhou na sessão anterior ao gerar evidências em `/tmp/` e não as salvar no repositório. Siga as regras abaixo milimetricamente.

---

## 1. O ERRO DA SESSÃO ANTERIOR (Não repita)
Na sessão anterior, você rodou testes e tirou screenshots, mas salvou tudo em `/tmp/` (arquivos efêmeros) e considerou o trabalho concluído. O usuário não teve acesso às evidências porque elas não foram commitadas no repositório.

**REGRA DE OURO:** Nenhuma validação é considerada concluída se a evidência não estiver fisicamente salva dentro do repositório (na pasta `docs/evidence/`) e commitada no git.

---

## 2. PROTOCOLO DE EVIDÊNCIAS VISUAIS (Frontend)

Sempre que você for solicitado a "validar visualmente", "tirar screenshot" ou "verificar UI", você **deve** seguir este fluxo:

1. **Criar a pasta de evidências:**
   ```bash
   mkdir -p docs/evidence/$(date +%Y-%m-%d)-ux-validation
   ```

2. **Gerar a evidência (usando script Playwright/Puppeteer ou ferramenta CLI):**
   - O arquivo de saída DEVE ser salvo dentro da pasta criada acima.
   - Exemplo: `docs/evidence/2026-04-07-ux-validation/dashboard-mobile-light.png`

3. **Gerar um relatório Markdown acompanhando as imagens:**
   - Crie um arquivo `docs/evidence/$(date +%Y-%m-%d)-ux-validation/REPORT.md`.
   - Descreva exatamente o que você validou, o que encontrou e anexe as imagens usando sintaxe Markdown (`![Dashboard](dashboard-mobile-light.png)`).

4. **Commitar e fazer Push:**
   ```bash
   git add docs/evidence/
   git commit -m "docs(evidence): adiciona validacao visual do dashboard"
   git push origin main
   ```

---

## 3. PROTOCOLO DE TESTES (Design-First)

O projeto sofre de uma assimetria: o backend tem testes, o frontend e a lógica de mapeamento ODS não têm.

### 3.1. Frontend (React Testing Library + Vitest)
Antes de criar qualquer lógica nova, você deve criar os testes de componente.

**Onde salvar:** `frontend/src/components/[pasta]/__tests__/[Componente].test.tsx`

**O que testar (Critérios Mínimos):**
- O componente renderiza sem quebrar?
- Os estados condicionais (ex: loading, error, success) renderizam a UI correta?
- Acessibilidade: elementos interativos têm ARIA labels? Cores de status são acompanhadas de ícones/texto?
- Interações do usuário (clicks, inputs) disparam as callbacks corretas?

### 3.2. Mappers ODS (Lógica de Negócio)
A conversão de dados brutos para ODS Score é a parte mais crítica do sistema.

**Onde salvar:** `tests/unit/agents/[agente]_ods_mapper.test.ts`

**O que testar (Critérios Mínimos):**
- Dado bruto da API X → deve resultar no Score Y.
- Tratamento de valores nulos, ausentes ou zeros.
- Valores de fronteira (boundary values).

---

## 4. CHECKLIST DE APROVAÇÃO (Binário)

Antes de reportar ao usuário que "terminou", responda mentalmente:

- [ ] Os testes que criei cobrem os cenários descritos acima? (Sim/Não)
- [ ] Rodei a suíte completa (`pnpm test`) e os testes novos + os antigos (918+) passaram? (Sim/Não)
- [ ] As evidências (screenshots, relatórios) foram salvas em `docs/evidence/`? (Sim/Não)
- [ ] Eu fiz o `git add`, `git commit` e `git push` das evidências para o remote? (Sim/Não)

**Se qualquer resposta for NÃO, seu trabalho não está pronto. Não pare. Corrija e faça o push.**
