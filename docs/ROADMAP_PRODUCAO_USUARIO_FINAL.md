# Roadmap: Preparação para o Usuário Final (Produção)

**Data:** 2026-04-10
**Alvo:** IOC ESG Municipal (Deploy em Produção)
**Autor:** Manus AI

## Visão Geral do Estado Atual

O projeto possui uma arquitetura robusta. A stack Docker (Postgres, Redis, Node.js, Vite) está madura, o sistema de autenticação (JWT) está funcionando, as rotas estão protegidas contra IDOR, e os testes E2E rodam no CI/CD.

No entanto, se colocarmos o sistema no ar **hoje**, o usuário final (ex: um prefeito ou gestor público) enfrentará problemas críticos que impedirão o uso real da plataforma. 

Este documento mapeia os gaps exatos e define um roadmap priorizado para o lançamento.

---

## 1. Gaps Críticos (Bloqueadores de Lançamento)

### 1.1. Coletores de Dados: Mocks vs. Realidade
O projeto possui 14 agentes coletores. A auditoria revelou que a maioria deles ainda não consome APIs reais, mas sim arquivos JSON estáticos e defasados.
*   **IEPS (ODS 3):** Lê `ieps_2021.json` (dados com 5 anos de defasagem).
*   **INEP (ODS 4):** Lê `ideb_2023.json`.
*   **SNIS (ODS 6):** Lê `snis_2022.json`.
*   **TSE (ODS 16):** Lê `tse_2024.json`.
*   **IBGE, SISVAN, Convenios:** Todos dependem de arquivos estáticos em `shared/data/`.

**O Risco:** O prefeito fará login, acessará o painel e verá dados de 2021 ou 2022. O sistema perderá credibilidade instantaneamente.
**A Solução:** Implementar a busca em tempo real nas APIs oficiais (DATASUS, IBGE, INEP) com fallback para os JSONs apenas em caso de falha da API.

### 1.2. Infraestrutura de Produção: Nginx e Certificados SSL
O arquivo `docker-compose.prod.yml` espera um serviço Nginx para expor a aplicação de forma segura:
```yaml
  nginx:
    image: nginx:alpine
    container_name: ioc_nginx_prod
    ports:
      - "80:80"
      - "443:443"
```
**O Problema:** A pasta `./nginx/ssl/` (necessária para os certificados HTTPS) não existe, e o `nginx.conf` está configurado para buscar esses arquivos. Se o deploy for feito agora, o container do Nginx falhará ao iniciar, derrubando o frontend.
**A Solução:** Configurar um proxy reverso automatizado (como Traefik ou Caddy) que gerencie os certificados Let's Encrypt automaticamente, ou ajustar o Nginx para rodar atrás de um Load Balancer gerenciado (ex: AWS ALB, Cloudflare).

### 1.3. Onboarding de Novos Municípios
A página `OnboardingPage.tsx` permite que o usuário selecione seu município.
**O Problema:** O código atual sugere apenas "5 municípios mais populosos de SC" (Joinville, Blumenau, etc.) e filtra a lista `SC_MUNICIPALITIES`. Se um prefeito do Paraná ou de São Paulo tentar se cadastrar, ele não encontrará sua cidade.
**A Solução:** Integrar a API de Localidades do IBGE no frontend para busca nacional, ou carregar a base completa de 5.570 municípios brasileiros no banco de dados durante o seed.

---

## 2. Roadmap Priorizado para Lançamento

Para que o Claude Code execute as tarefas finais, siga esta ordem de prioridade (copie e cole o bloco de comando para ele):

### Fase 1: Integridade dos Dados (Prioridade Máxima)
> `/orchestrator Leia docs/ROADMAP_PRODUCAO_USUARIO_FINAL.md. Sua missão é a Fase 1: Substituir os coletores baseados em JSON (IEPS, INEP, SNIS, TSE) por integrações reais com as APIs do governo. Os arquivos JSON em shared/data/ devem se tornar apenas fallbacks de último recurso. Atualize os testes dos mappers para garantir que a integração real funcione.`

### Fase 2: Onboarding Nacional (Prioridade Alta)
> `/orchestrator Leia docs/ROADMAP_PRODUCAO_USUARIO_FINAL.md. Sua missão é a Fase 2: Atualizar a OnboardingPage.tsx. Remova o hardcode de SC_MUNICIPALITIES. Implemente um endpoint no backend que busque os municípios diretamente do banco de dados (que deve ser populado com os 5.570 municípios via seed) ou integre a API de Localidades do IBGE para busca assíncrona.`

### Fase 3: Infraestrutura SSL / Proxy Reverso (Prioridade Média)
> `/orchestrator Leia docs/ROADMAP_PRODUCAO_USUARIO_FINAL.md. Sua missão é a Fase 3: Refatorar o docker-compose.prod.yml e a configuração do Nginx. Implemente o Traefik ou configure o certbot no Nginx para geração automática de certificados Let's Encrypt, garantindo que a aplicação suba em HTTPS sem necessidade de certificados manuais na pasta ./nginx/ssl/.`

---

## Conclusão

A plataforma está muito próxima da linha de chegada. Assim que os dados reais substituírem os mocks (Fase 1) e o onboarding for nacionalizado (Fase 2), o sistema estará pronto para gerar valor real para os gestores públicos.
