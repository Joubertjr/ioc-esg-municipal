# GUIA DE DESENVOLVIMENTO - IOC ESG MUNICIPAL

## Bem-vindo Claude Code!

Este é o guia de desenvolvimento para o **IOC ESG Municipal**. Aqui você encontrará tudo que precisa para começar a implementação.

---

## 📁 Estrutura de Diretórios

```
6_CODIGO/
├── backend/              # APIs e lógica de negócio
│   ├── agents/          # Agentes de coleta de dados
│   ├── services/        # Serviços de processamento
│   ├── models/          # Modelos de dados
│   └── routes/          # Endpoints da API
├── frontend/            # Interface do usuário
│   ├── components/      # Componentes React
│   ├── pages/          # Páginas da aplicação
│   ├── hooks/          # Custom hooks
│   └── styles/         # Estilos CSS/Tailwind
├── shared/             # Código compartilhado
│   ├── types/          # TypeScript types
│   ├── constants/      # Constantes
│   └── utils/          # Funções utilitárias
├── tests/              # Testes automatizados
│   ├── unit/           # Testes unitários
│   ├── integration/    # Testes de integração
│   └── e2e/            # Testes end-to-end
├── config/             # Configurações
│   ├── env.example     # Variáveis de ambiente
│   ├── database.ts     # Configuração de BD
│   └── api.ts          # Configuração de APIs
└── GUIA_DESENVOLVIMENTO.md (este arquivo)
```

---

## 🚀 Fase 1: MVP (Semanas 1-8)

### Objetivo
Criar um MVP funcional com:
- Dashboard básico (3 ODS)
- Coleta de dados (IBGE, Tesouro, DATASUS)
- Simulador básico
- Relatório simples

### Semana 1-2: Setup e Infraestrutura

**Tarefas:**
1. Configurar ambiente (Node.js, Python, PostgreSQL)
2. Criar estrutura de banco de dados
3. Configurar APIs de dados abertos
4. Setup de autenticação

**Arquivos a criar:**
- `config/env.example` - Variáveis de ambiente
- `config/database.ts` - Schema do banco
- `backend/models/` - Modelos de dados

### Semana 3-4: Agentes de Coleta

**Tarefas:**
1. Criar agente IBGE (população, renda, desemprego)
2. Criar agente Tesouro (FPM, saldos)
3. Criar agente DATASUS (saúde)
4. Implementar validação de dados

**Arquivos a criar:**
- `backend/agents/ibge_agent.ts`
- `backend/agents/tesouro_agent.ts`
- `backend/agents/datasus_agent.ts`
- `backend/services/data_validator.ts`

### Semana 5-6: Dashboard Básico

**Tarefas:**
1. Criar layout do dashboard
2. Implementar visualização de 3 ODS
3. Criar cards de indicadores
4. Implementar gráficos básicos

**Arquivos a criar:**
- `frontend/pages/dashboard.tsx`
- `frontend/components/ODS_Card.tsx`
- `frontend/components/Chart.tsx`

### Semana 7-8: Simulador Básico

**Tarefas:**
1. Criar interface de simulação
2. Implementar cálculo de impacto
3. Gerar relatório simples
4. Testes e ajustes

**Arquivos a criar:**
- `frontend/pages/simulator.tsx`
- `backend/services/simulator.ts`
- `backend/services/report_generator.ts`

---

## 🔧 Stack Tecnológico Recomendado

### Backend
- **Runtime:** Node.js 18+ ou Python 3.11+
- **Framework:** Express.js (Node) ou FastAPI (Python)
- **Database:** PostgreSQL
- **ORM:** Prisma ou SQLAlchemy
- **APIs:** Axios para chamadas HTTP

### Frontend
- **Framework:** React 18+
- **TypeScript:** Sim
- **UI:** Tailwind CSS + Shadcn/ui
- **Charts:** Recharts ou Chart.js
- **State:** Zustand ou Redux
- **Build:** Vite

### DevOps
- **Containerização:** Docker
- **Orquestração:** Docker Compose
- **CI/CD:** GitHub Actions
- **Hosting:** AWS ou DigitalOcean

---

## 📝 Modelos de Dados Principais

### Municipality
```typescript
{
  id: string
  name: string
  state: string
  population: number
  fpm_received: number
  fpm_used: number
  fpm_balance: number
  created_at: timestamp
}
```

### ODS_Indicator
```typescript
{
  id: string
  municipality_id: string
  ods_number: 1-17
  indicator_name: string
  current_value: number
  target_value: number
  source: string
  last_update: timestamp
}
```

### Simulation
```typescript
{
  id: string
  municipality_id: string
  scenario_name: string
  investment_amount: number
  investment_type: string
  projected_impact: object
  created_at: timestamp
}
```

---

## 🔌 APIs a Integrar (Fase 1)

### IBGE
- **Endpoint:** https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{id}
- **Dados:** População, renda, desemprego
- **Frequência:** Anual

### Tesouro Nacional
- **Portal:** https://siconfi.tesouro.gov.br/
- **Dados:** FPM, saldos, execução
- **Frequência:** Mensal

### DATASUS
- **Endpoint:** https://datasus.saude.gov.br/
- **Dados:** Mortalidade, cobertura
- **Frequência:** Mensal

---

## ✅ Checklist de Implementação

### Semana 1-2
- [ ] Ambiente configurado
- [ ] Banco de dados criado
- [ ] Autenticação implementada
- [ ] Variáveis de ambiente definidas

### Semana 3-4
- [ ] Agente IBGE funcionando
- [ ] Agente Tesouro funcionando
- [ ] Agente DATASUS funcionando
- [ ] Validação de dados implementada

### Semana 5-6
- [ ] Dashboard básico criado
- [ ] 3 ODS visualizados
- [ ] Gráficos funcionando
- [ ] Responsividade testada

### Semana 7-8
- [ ] Simulador funcionando
- [ ] Cálculo de impacto correto
- [ ] Relatório gerado
- [ ] Testes passando

---

## 🧪 Testes

### Testes Unitários
```bash
npm run test:unit
```

### Testes de Integração
```bash
npm run test:integration
```

### Testes E2E
```bash
npm run test:e2e
```

---

## 📊 Métricas de Sucesso (MVP)

- ✅ Dashboard carregando em < 2 segundos
- ✅ Dados atualizados mensalmente
- ✅ 3 ODS funcionando corretamente
- ✅ Simulador com acurácia > 90%
- ✅ Relatório gerado em < 5 segundos
- ✅ Cobertura de testes > 70%

---

## 🚀 Deployment

### Desenvolvimento
```bash
docker-compose up
```

### Produção
```bash
docker build -t ioc-esg .
docker push seu-registry/ioc-esg
kubectl apply -f deployment.yaml
```

---

## 📚 Documentação Adicional

Consulte os documentos de especificação em:
- `1_ESPECIFICACAO/DOCUMENTO_FINAL_IOC_ESG_MUNICIPAL.md`
- `2_PESQUISA/05_MAPA_DADOS_ABERTOS.md`
- `4_IMPLEMENTACAO/01_GUIA_INTEGRACAO_APIS.md`

---

## 💬 Dúvidas?

Consulte:
1. README.md (raiz do projeto)
2. Documentação de especificação
3. Guias de implementação

---

**Bom desenvolvimento! 🚀**
