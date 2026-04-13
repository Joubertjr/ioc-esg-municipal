# Plano de Containerização do Ambiente de Desenvolvimento

**Data:** 2026-04-10
**Objetivo:** Eliminar o "funciona na minha máquina" e garantir que 100% da stack de desenvolvimento (Postgres, Redis, Backend, Frontend) rode dentro do Docker, atendendo ao requisito do usuário de que "tem que ter tudo no docker".

## 1. O Problema Atual

A auditoria revelou que o `docker-compose.yml` atual (usado para dev) inicia apenas o banco de dados (PostgreSQL) e o cache (Redis). 

O Backend (API Node.js) e o Frontend (React/Vite) estão sendo executados no *host* (na máquina física do desenvolvedor) através do comando `pnpm dev`. 

Isso viola a premissa de um ambiente 100% containerizado, gerando os seguintes problemas:
*   **Dependência de Ambiente:** O desenvolvedor precisa ter o Node.js 20+ e o pnpm instalados localmente.
*   **Inconsistência de SO:** O código roda no macOS/Windows local, mas a produção roda em Alpine Linux. Erros de caminhos de arquivos (ex: maiúsculas/minúsculas) podem passar despercebidos no dev e quebrar em prod.
*   **Conflito de Portas:** Se o desenvolvedor já tiver algo rodando na porta 3000 ou 5173, o projeto não sobe.

## 2. A Solução: `docker-compose.dev.yml`

Para resolver isso sem perder a velocidade de desenvolvimento (Hot Module Replacement - HMR), precisamos criar um novo arquivo `docker-compose.dev.yml` que encapsula o Node.js, mas monta o código-fonte como um *volume* (bind mount).

### Arquitetura Proposta

| Serviço | Imagem Base | Comando | Volumes (Bind Mount) | Portas |
| :--- | :--- | :--- | :--- | :--- |
| `postgres` | `postgres:15-alpine` | Padrão | `pgdata` (nomeado) | 5432 |
| `redis` | `redis:7-alpine` | Padrão | `redisdata` (nomeado) | 6379 |
| `api` | `node:20-alpine` | `pnpm dev:backend` | `./:/app` | 3000 |
| `frontend` | `node:20-alpine` | `pnpm dev:frontend` | `./:/app` | 5173 |

### 3. O Desafio do Vite (Frontend) no Docker

O Vite (usado no frontend) é otimizado para rodar localmente. Quando colocado dentro do Docker, o HMR (Hot Module Replacement - que atualiza a tela automaticamente quando o código muda) costuma falhar por problemas de binding de IP e polling de arquivos.

**Solução:** O `vite.config.ts` precisará ser atualizado para expor o host (`host: '0.0.0.0'`) e forçar o uso de *polling* (necessário quando o Docker roda em Windows/macOS, pois eventos de sistema de arquivos não atravessam a VM do Docker de forma confiável).

---

## 4. Task File de Implementação

*(Este bloco deve ser fornecido ao Claude Code para executar a refatoração)*

```markdown
# TASK: Containerização Total do Ambiente Dev

**Objetivo:** Garantir que o ambiente de desenvolvimento rode 100% no Docker, sem necessidade de Node.js instalado no host.

**Critérios de Aceite:**

1. **Atualizar `docker-compose.yml`:**
   - Adicione os serviços `api` e `frontend` usando a imagem `node:20-alpine`.
   - Configure os *bind mounts* (`volumes: - ./:/app`) para refletir as mudanças de código em tempo real.
   - Configure o comando de inicialização para instalar dependências e iniciar o watch (`command: sh -c "corepack enable pnpm && pnpm install && pnpm run dev:backend"`). *Nota: corepack é necessário na imagem node:20-alpine para usar pnpm*.
   - Configure as dependências (`depends_on: postgres, redis`).

2. **Configurar o Vite para Docker (HMR):**
   - Altere o `vite.config.ts` no frontend para garantir que o HMR funcione via polling e exponha o host `0.0.0.0`. Exemplo:
     ```typescript
     server: {
       host: '0.0.0.0',
       port: 5173,
       watch: { usePolling: true }
     }
     ```

3. **Atualizar Scripts e Documentação:**
   - Atualize o `package.json` (se necessário) para refletir que o comando principal de dev agora é `docker compose up`.
   - Atualize o `README.md` e o `docs/DESENVOLVIMENTO.md` para instruir os novos desenvolvedores a usar o Docker Compose em vez do `pnpm dev` local.
   - Atualize o `scripts/smoke-test-stack.sh` para garantir que ele continua funcionando com a nova arquitetura de dev (verificando se o frontend e a API respondem nas portas corretas).
```
