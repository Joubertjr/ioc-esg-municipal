# Revisão de Estado — Foco Exclusivo em Santa Catarina (SC)

## 1. Premissa de Negócio
O objetivo do projeto foi restrito: **entregar o software funcionando perfeitamente para os usuários de Santa Catarina (SC)**. Nenhuma funcionalidade adicional, expansão nacional ou evolução arquitetural deve ser implementada até que o produto seja aprovado com o cliente final de SC.

## 2. Auditoria do Estado Atual vs. Uso Real em SC

Após uma auditoria técnica profunda na base de código, verificamos o que está pronto e o que ainda bloqueia o uso real da plataforma por um prefeito catarinense.

### 2.1. O que está PRONTO e FUNCIONANDO para SC
- **Frontend & Onboarding:** A tela de onboarding (`OnboardingPage.tsx`) já está perfeitamente restrita aos 295 municípios de SC. O banco de dados (Prisma seed) contém exatamente as 295 cidades catarinenses.
- **Autenticação:** Login, JWT e middleware de segurança anti-IDOR (prefeito de Blumenau não vê dados de Joinville) implementados e validados.
- **Infraestrutura Dev/Prod:** Ambiente 100% Dockerizado (Postgres, Redis, Backend, Frontend) funcionando localmente e com Dockerfile multi-stage pronto para produção.
- **Integração de APIs (7 Coletores Reais):** DATASUS, INPE, PNCP, SICONFI, IBGE (parcial), SNIS-RS e ANA já estão consumindo dados reais das APIs governamentais.
- **Motores Core:** Knowledge Graph (ODS Interlinkages), LongMemEval (avaliação de memória) e Simulador FPM estão operacionais.

### 2.2. O que BLOQUEIA o uso real em SC (Gaps Críticos)

Apesar da infraestrutura robusta, **o usuário final ainda não pode usar o software em produção devido a 2 gaps críticos**:

#### GAP 1: Dados Estáticos e Defasados (Risco de Credibilidade)
8 dos 15 agentes coletores ainda estão lendo arquivos JSON estáticos e mockados da pasta `shared/data/` em vez de consumir APIs reais. Isso significa que o prefeito verá dados com até 5 anos de defasagem:
- **IEPS (ODS 3):** Lê `ieps_2021.json` (5 anos de defasagem).
- **INEP (ODS 4):** Lê `ideb_2023.json`.
- **SNIS (ODS 6):** Lê `snis_2022.json`.
- **TSE (ODS 5):** Lê `tse_2024.json`.
- **SISVAN (ODS 2):** Lê `sisvan_2023.json`.
- **Convenios (ODS 17):** Lê `convenios_2023.json`.
- **ANEEL (ODS 7):** Lê `aneel_gd_2023.json`.
- **ANATEL (ODS 9):** Lê `anatel_2023.json`.

**Impacto:** Se o prefeito de Joinville acessar a plataforma hoje, ele verá a nota de saúde baseada em dados da pandemia (2021). A plataforma perde a credibilidade imediatamente.

#### GAP 2: Deploy de Produção (Nginx SSL)
O arquivo `docker-compose.prod.yml` e o `nginx.conf` exigem certificados SSL na pasta `nginx/ssl/` (cert.pem e key.pem). Como essa pasta não existe e não há um script de provisionamento automático (como Certbot), **o container do Nginx falha ao iniciar**, derrubando o acesso externo à plataforma.

## 3. Próximos Passos (Task File para Claude Code)

Para atingir o objetivo de entregar o software funcionando em SC, o Claude Code deve executar estritamente as seguintes tarefas, em ordem de prioridade:

1. **Substituir JSONs por APIs Reais (Foco SC):**
   - Refatorar os 8 coletores listados no GAP 1 para consumirem as APIs ou bases de dados públicas atualizadas.
   - *Nota:* Se a API governamental for inexistente e o JSON for a única fonte oficial (ex: planilhas anuais do SNIS), criar um script automatizado (scraper/downloader) que atualize o JSON para o ano mais recente disponível (ex: 2024/2025).

2. **Resolver o Gargalo do Nginx/SSL:**
   - Atualizar a configuração de produção para provisionar certificados SSL automaticamente (ex: usar `jwilder/nginx-proxy` + `letsencrypt-nginx-proxy-companion` ou configurar o Nginx para rodar em HTTP internamente se o SSL for provido por um Load Balancer da nuvem).

**Regra:** Nenhuma outra feature deve ser tocada. O Claude Code deve focar 100% em resolver os dados estáticos e o gargalo de infraestrutura para colocar o ambiente de SC no ar.
