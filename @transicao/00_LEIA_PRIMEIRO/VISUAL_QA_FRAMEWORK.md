# Visual QA Framework: Aplicação no Projeto IOC

Este documento traduz o framework genérico de Visual QA para a realidade específica do projeto **IOC ESG Municipal**, definindo como o Claude Code e os engenheiros humanos devem colaborar para garantir um produto de classe mundial.

---

## 1. O Ciclo de Desenvolvimento Híbrido (IOC Flow)

No IOC, o desenvolvimento não termina quando os testes unitários passam. O ciclo completo de uma *feature* de UI segue um fluxo estrito de 4 etapas:

1.  **Code & Test (Claude Code):** O agente escreve o componente React, os testes no Vitest e garante que o TypeScript compila sem erros (`tsc --noEmit`).
2.  **Evidence Generation (Claude Code):** O agente levanta o servidor Vite, abre o Chrome via Playwright ou DevTools, tira os *screenshots* obrigatórios (Light/Dark, Mobile/Desktop) e salva na pasta `docs/evidence/`.
3.  **Visual Audit (Humano/Manus AI):** O revisor inspeciona os *screenshots* no repositório. Se houver qualquer desvio de *design* (ex: bordas duras, contrastes ruins, *typos*), o *commit* é reprovado.
4.  **Bug Bash & Merge:** O agente recebe o *feedback* visual, corrige o CSS/Tailwind, gera novas evidências e, somente após a aprovação final, o código é mesclado (*merged*).

---

## 2. Regras Invioláveis para o Claude Code

Para que o framework funcione, o agente de IA deve seguir estas regras sem exceções:

*   **Regra do Commit Atômico:** Nunca faça um *commit* de alteração de UI sem incluir os respectivos *screenshots* na pasta `docs/evidence/`. Um *commit* de frontend sem evidência visual é considerado inválido.
*   **Regra do Dark Mode:** Toda nova tela ou componente complexo deve ter prova visual de funcionamento no tema escuro. O agente deve garantir que gráficos (Recharts) e *backgrounds* herdem as cores corretamente (`bg-transparent`, `stroke-currentColor`).
*   **Regra do Empty State:** Nenhuma tela pode quebrar ou mostrar mensagens técnicas de erro. O agente deve proativamente projetar *empty states* elegantes (com ícones e CTAs) para cenários sem dados ou rotas não encontradas.

---

## 3. O Padrão de Classe Mundial do IOC (Checklist)

O IOC não busca ser apenas um sistema funcional; ele deve ter a estética de um produto premium internacional. O Claude Code deve aplicar este *checklist* antes de considerar uma tela pronta:

| Elemento | Padrão Esperado no IOC |
| :--- | :--- |
| **Navegação** | *Floating Bottom Tab Bar* no Mobile, *Navigation Rail* no Desktop. Sem *hamburger menus* legados. |
| **Métricas Principais** | Uso obrigatório de `tabular-nums` e tamanhos "Hero" (`text-5xl` ou maior) para o Score Global. |
| **Bordas e Sombras** | Remoção de `border-border` em favor de `shadow-sm` e `bg-card` para separar camadas de informação, reduzindo o ruído visual. |
| **Gráficos (Recharts)** | Fundo estritamente transparente (`style={{ background: "transparent" }}`). Barras de progresso com cantos arredondados (`rounded-full`). |
| **Dados Geográficos** | Usuários nunca devem ver códigos do IBGE na interface. O agente deve usar dicionários de *lookup* para mostrar nomes reais de municípios. |

---

## 4. Estrutura de Evidências no Repositório

O Claude Code deve salvar as evidências seguindo estritamente esta estrutura:

```text
ioc-esg-municipal/
└── docs/
    └── evidence/
        └── YYYY-MM-DD-nome-da-fase/
            ├── REPORT.md                        # O que foi feito e como testar
            ├── dashboard-mobile-light.png       # Acima da dobra
            ├── dashboard-mobile-light-full.png  # Página inteira
            └── dashboard-mobile-dark.png        # Tema escuro
```

**Instrução de Execução para o Agente:** Ao finalizar uma tarefa de UI, utilize um *script* Node.js com Puppeteer/Playwright ou as ferramentas do navegador para capturar a tela. Salve os arquivos, adicione-os ao `git staging` junto com as alterações de código e faça o *commit*.
