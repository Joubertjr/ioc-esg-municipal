# Validação: Containerização do Ambiente Dev (Commit 69cbd84)

**Data:** 2026-04-10
**Alvo:** `docker-compose.yml`, `Dockerfile.dev`, `vite.config.ts`
**Autor:** Manus AI

## Resumo da Auditoria

A execução do Claude Code foi excelente na criação da arquitetura de containers para o ambiente de desenvolvimento. Ele implementou o `Dockerfile.dev` com `node:20-bookworm-slim`, o Prisma, o pnpm, e orquestrou tudo no `docker-compose.yml` com os 4 serviços rodando juntos.

O ambiente de desenvolvimento agora é **100% Docker**, cumprindo a exigência do usuário. No entanto, como parte do nosso processo de melhoria contínua, identifiquei 3 fragilidades arquiteturais que podem causar problemas silenciosos para os desenvolvedores no dia a dia.

---

## 1. O que foi bem feito (Aprovado)

*   **Imagem Base Otimizada:** O uso de `node:20-bookworm-slim` com a instalação do `openssl` garante que o Prisma funcione perfeitamente no Debian, resolvendo um problema clássico de motores do Prisma no Alpine.
*   **Bind Mounts Granulares:** O frontend faz mount inteligente (`./frontend/src:/app/frontend/src`), evitando sobrescrever o `/app/node_modules` interno do container com os módulos compilados do host.
*   **Seed Automático Inteligente:** O script de inicialização (`npx prisma migrate deploy && npx tsx prisma/seed.ts`) garante que o banco de dados esteja sempre pronto para uso, e o seed foi atualizado para criar o usuário admin (`admin@ioc.local`) usado pelo smoke test.
*   **Proxy Vite Configurado:** O Vite está corretamente configurado para rotear chamadas `/api` para o backend.

---

## 2. Oportunidades de Melhoria (Riscos Silenciosos)

A auditoria revelou os seguintes problemas que precisam ser corrigidos para evitar dores de cabeça na experiência do desenvolvedor:

### 2.1. `VITE_API_URL` apontando para DNS interno (Erro no Browser)
No `docker-compose.yml`, a variável de ambiente do frontend está definida como:
```yaml
VITE_API_URL: http://backend:3000
```
**O Problema:** Essa variável é injetada no código do frontend que roda **no navegador do usuário**, não dentro do container. O navegador do usuário não consegue resolver `http://backend:3000` porque `backend` é um DNS interno da rede do Docker. 
**A Solução:** O frontend deve apontar para `http://localhost:3000` (que é a porta exposta pelo Docker no host) ou simplesmente omitir a variável, já que o proxy do Vite (`/api`) já está configurado para fazer esse roteamento internamente.

### 2.2. Vite Polling Ausente (Falha de HMR no Windows/macOS)
O plano especificava explicitamente a necessidade de adicionar `watch: { usePolling: true }` no `vite.config.ts`. O Claude Code não fez isso.
**O Problema:** Quando o Docker Desktop roda no Windows (WSL2) ou macOS, os eventos de mudança de arquivo do sistema host não são propagados de forma confiável para o container Linux. Sem o polling, o desenvolvedor salva o arquivo, mas a tela do React não atualiza.

### 2.3. Seed Executado a Cada Restart
O comando de inicialização do backend é:
```yaml
command: sh -c "npx prisma migrate deploy && npx tsx prisma/seed.ts && pnpm dev:backend"
```
**O Problema:** Toda vez que o container do backend for reiniciado, o script de seed será executado novamente, o que atrasa a inicialização e pode causar problemas de integridade se o script de seed não for perfeitamente idempotente (embora o Prisma `upsert` mitigue isso parcialmente, não é uma boa prática).

---

## 3. Task File de Melhoria Contínua

*(Este bloco deve ser fornecido ao Claude Code para refatorar o ambiente dev)*

```markdown
# TASK: Refinamento da Containerização Dev

**Objetivo:** Corrigir fragilidades arquiteturais introduzidas na containerização do ambiente de desenvolvimento.

**Critérios de Aceite:**

1. **Corrigir DNS do Frontend no Browser:** No `docker-compose.yml`, altere a variável de ambiente `VITE_API_URL` do serviço `frontend` para `http://localhost:3000` (ou remova-a se o proxy do Vite já resolver). O valor atual (`http://backend:3000`) quebra chamadas de API feitas pelo navegador do desenvolvedor.
2. **Ativar Polling no Vite (HMR):** No arquivo `frontend/vite.config.ts`, adicione `watch: { usePolling: true }` dentro do objeto `server`. Isso é obrigatório para que o Hot Module Replacement funcione de forma confiável através do bind mount do Docker no Windows/macOS.
3. **Otimizar Inicialização do Backend:** Remova a execução do `seed.ts` do comando de inicialização contínua do serviço `backend` no `docker-compose.yml`. O seed deve ser rodado manualmente ou movido para um script de inicialização (`init.sh`) que verifica se o banco já está populado antes de rodar o seed pesado.
```
