# Estado Atual do Projeto — Foco SC

**Data da Última Atualização:** 13 de abril de 2026
**Objetivo Único:** Entregar a plataforma funcionando perfeitamente para os 295 municípios de Santa Catarina (SC) e obter aprovação do cliente final. Nenhuma feature além desse escopo deve ser desenvolvida.

---

## 1. Visão Geral da Prontidão (Readiness)

A plataforma IOC ESG Municipal encontra-se **pronta para uso em ambiente de produção (SC)**. Todos os bloqueadores técnicos e gaps de dados que impediam a utilização real por um prefeito catarinense foram resolvidos.

| Componente Crítico               | Status         | Detalhes                                                                                                                               |
| -------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Infraestrutura Docker (Prod)** | ✅ Operacional | `docker-compose.prod.yml` com Nginx (HTTP-only) + Node.js + Postgres + Redis. SSL opt-in configurado.                                  |
| **Segurança e Autenticação**     | ✅ Operacional | JWT com Refresh Token, senhas hasheadas, middleware anti-IDOR (prefeito só acessa seu município).                                      |
| **Onboarding de Usuários**       | ✅ Operacional | Fluxo restrito aos 295 municípios de SC. Usuários vinculam-se via código IBGE.                                                         |
| **Integração de Dados Reais**    | ✅ Operacional | 7 coletores via API em tempo real + 7 coletores estáticos (com scripts de atualização automatizada e `__meta.referenceYear` dinâmico). |
| **Dashboard e Simulação**        | ✅ Operacional | Interface responsiva, simulação de FPM, ranking SC (Benchmark) e relatórios de recomendações por IA.                                   |

---

## 2. Inventário de Coletores de Dados (Os 14 Agentes)

A credibilidade do sistema depende da atualidade dos dados. A tabela abaixo reflete a fonte real de cada coletor no momento do deploy em SC.

### 2.1. Coletores em Tempo Real (APIs Governamentais)

1. **DATASUS:** API REST (datasus.saude.gov.br)
2. **INPE:** API REST (terrabrasilis.dpi.inpe.br)
3. **PNCP:** API REST (pncp.gov.br)
4. **SICONFI:** API REST (api.siconfi.tesouro.gov.br)
5. **IBGE:** API REST (servicodados.ibge.gov.br)
6. **ANA:** Integração direta
7. **SNIS-RS:** Integração direta

### 2.2. Coletores de Dados Estáticos (Arquivos JSON)

Estes coletores dependem de bases que o governo atualiza anualmente ou bienalmente via planilhas/dumps. Os dados são mantidos em `shared/data/*_latest.json` e podem ser atualizados a qualquer momento executando os scripts `pnpm data:update:*`.

1. **IEPS (Saúde):** Lê `ieps_latest.json` (Atualizado via script TypeScript).
2. **INEP (Educação - IDEB):** Lê `ideb_latest.json` (Atualizado via script TypeScript).
3. **SNIS (Saneamento):** Lê `snis_latest.json` (Atualizado via script TypeScript).
4. **SISVAN (Nutrição):** Lê `sisvan_latest.json` (Atualizado via script TypeScript).
5. **ANATEL (Conectividade):** Lê `anatel_latest.json` (Atualizado via script TypeScript).
6. **ANEEL (Energia):** Lê `aneel_latest.json` (Atualizado via script TypeScript).
7. **Convênios (Transferências):** Lê `convenios_latest.json` (Atualizado via script TypeScript).

_Nota: Todos os 7 JSONs possuem a chave `__meta` com o `referenceYear` lido dinamicamente pelo coletor._

---

## 3. Próximos Passos Imediatos (Go-Live SC)

A plataforma não requer mais código para funcionar em SC. Os próximos passos são puramente operacionais:

1. **Smoke Test Final:** Executar o script de smoke test (`smoke-test-stack.sh`) garantindo que os 295 municípios completem o ciclo de cálculo ODS sem falhas de timeout ou validação Zod.
2. **Provisionamento de Infraestrutura:**
   - Configurar o servidor (e.g., AWS EC2, DigitalOcean).
   - Apontar o domínio oficial (e.g., `app.ioc.com.br`).
   - Preencher o `.env` de produção (senhas fortes, JWT_SECRET gerado via OpenSSL).
3. **Deploy:** Executar `docker compose -f docker-compose.prod.yml up -d`.
4. **SSL (Opcional, mas recomendado):** Executar `./scripts/setup-ssl.sh` com o domínio configurado.

---

## 4. O Que NÃO Fazer (Regras de Ouro)

Até que o cliente final (Prefeitura em SC) valide e aprove o produto em produção:

- **NÃO** adicione suporte a municípios fora de SC.
- **NÃO** crie novas telas de relatórios ou dashboards administrativos.
- **NÃO** altere a arquitetura do banco de dados (Prisma) para suportar multi-tenant complexo (o isolamento atual por `municipalityId` é suficiente).
- **NÃO** gaste tempo otimizando performance prematuramente a menos que um endpoint específico esteja falhando em produção.
