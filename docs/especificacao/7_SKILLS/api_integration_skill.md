# API INTEGRATION SKILL

## Objetivo
Integrar dados de APIs públicas (IBGE, Tesouro, DATASUS, etc.) ao IOC ESG Municipal de forma robusta, com tratamento de erros, caching e rate limiting.

## Pré-requisitos
- Node.js 18+
- Conhecimento de APIs REST
- Axios ou similar
- PostgreSQL
- Redis (para caching)

## Conceitos-Chave

### Rate Limiting
Limite de requisições por minuto/hora para não sobrecarregar APIs públicas.

### Caching
Armazenar respostas para evitar chamadas desnecessárias.

### Retry Logic
Tentar novamente se a requisição falhar.

### Data Normalization
Converter dados de diferentes formatos para um padrão único.

## Passo a Passo

### 1. Criar Base Agent Class

```typescript
// backend/agents/base_agent.ts

import axios, { AxiosInstance } from 'axios';
import Redis from 'redis';

export abstract class BaseAgent {
  protected client: AxiosInstance;
  protected redis: Redis.RedisClient;
  protected baseUrl: string;
  protected cachePrefix: string;
  protected cacheTTL: number = 3600; // 1 hora

  constructor(baseUrl: string, cachePrefix: string) {
    this.baseUrl = baseUrl;
    this.cachePrefix = cachePrefix;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
    });
    this.redis = Redis.createClient();
  }

  /**
   * Buscar dados com cache
   */
  async fetchWithCache(
    endpoint: string,
    params?: any
  ): Promise<any> {
    const cacheKey = `${this.cachePrefix}:${endpoint}:${JSON.stringify(params)}`;

    // Tentar buscar do cache
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        console.log(`Cache hit: ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn(`Cache error: ${error}`);
    }

    // Se não estiver em cache, buscar da API
    const data = await this.fetchWithRetry(endpoint, params);

    // Armazenar em cache
    try {
      await this.redis.setex(
        cacheKey,
        this.cacheTTL,
        JSON.stringify(data)
      );
    } catch (error) {
      console.warn(`Cache set error: ${error}`);
    }

    return data;
  }

  /**
   * Buscar com retry automático
   */
  async fetchWithRetry(
    endpoint: string,
    params?: any,
    retries: number = 3
  ): Promise<any> {
    try {
      const response = await this.client.get(endpoint, { params });
      return response.data;
    } catch (error: any) {
      if (retries > 0 && this.isRetryable(error)) {
        const delay = Math.pow(2, 3 - retries) * 1000; // Exponential backoff
        console.log(`Retry in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(endpoint, params, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Verificar se erro é retentável
   */
  private isRetryable(error: any): boolean {
    const status = error.response?.status;
    return status === 408 || status === 429 || status === 500 || status === 503;
  }

  /**
   * Normalizar dados (implementar em subclasses)
   */
  abstract normalize(data: any): any;
}
```

### 2. Implementar IBGE Agent

```typescript
// backend/agents/ibge_agent.ts

import { BaseAgent } from './base_agent';

export class IBGEAgent extends BaseAgent {
  constructor() {
    super(
      'https://servicodados.ibge.gov.br/api/v1',
      'ibge'
    );
  }

  /**
   * Buscar dados de município
   */
  async getMunicipalityData(municipalityId: string) {
    const endpoint = `/localidades/municipios/${municipalityId}`;
    const data = await this.fetchWithCache(endpoint);
    return this.normalize(data);
  }

  /**
   * Buscar população
   */
  async getPopulation(municipalityId: string) {
    const data = await this.getMunicipalityData(municipalityId);
    return {
      municipalityId,
      population: data.population,
      source: 'IBGE',
      lastUpdate: new Date(),
    };
  }

  /**
   * Normalizar dados do IBGE
   */
  normalize(data: any) {
    return {
      id: data.id,
      name: data.nome,
      state: data.microrregiao?.mesorregiao?.uf?.sigla,
      population: data.populacao || 0,
      area: data.area || 0,
    };
  }
}
```

### 3. Implementar Tesouro Agent

```typescript
// backend/agents/tesouro_agent.ts

import { BaseAgent } from './base_agent';

export class TesourAgent extends BaseAgent {
  constructor() {
    super(
      'https://siconfi.tesouro.gov.br/api',
      'tesouro'
    );
  }

  /**
   * Buscar dados de FPM
   */
  async getFPMData(municipalityCode: string, year: number) {
    const endpoint = `/fpm/${municipalityCode}/${year}`;
    const data = await this.fetchWithCache(endpoint);
    return this.normalize(data);
  }

  /**
   * Buscar saldo de FPM não utilizado
   */
  async getFPMBalance(municipalityCode: string) {
    const data = await this.getFPMData(municipalityCode, new Date().getFullYear());
    return {
      municipalityCode,
      fpmReceived: data.received,
      fpmUsed: data.used,
      fpmBalance: data.received - data.used,
      executionRate: (data.used / data.received) * 100,
    };
  }

  /**
   * Normalizar dados do Tesouro
   */
  normalize(data: any) {
    return {
      received: data.valor_recebido || 0,
      used: data.valor_gasto || 0,
      balance: (data.valor_recebido || 0) - (data.valor_gasto || 0),
    };
  }
}
```

### 4. Implementar DATASUS Agent

```typescript
// backend/agents/datasus_agent.ts

import { BaseAgent } from './base_agent';

export class DATASUSAgent extends BaseAgent {
  constructor() {
    super(
      'https://datasus.saude.gov.br/api',
      'datasus'
    );
  }

  /**
   * Buscar dados de saúde
   */
  async getHealthData(municipalityCode: string, year: number) {
    const endpoint = `/health/${municipalityCode}/${year}`;
    const data = await this.fetchWithCache(endpoint);
    return this.normalize(data);
  }

  /**
   * Buscar mortalidade infantil
   */
  async getInfantMortality(municipalityCode: string) {
    const data = await this.getHealthData(municipalityCode, new Date().getFullYear());
    return {
      municipalityCode,
      infantMortality: data.infantMortality,
      maternalMortality: data.maternalMortality,
      vaccinationCoverage: data.vaccinationCoverage,
    };
  }

  /**
   * Normalizar dados do DATASUS
   */
  normalize(data: any) {
    return {
      infantMortality: data.taxa_mortalidade_infantil || 0,
      maternalMortality: data.taxa_mortalidade_materna || 0,
      vaccinationCoverage: data.cobertura_vacinacao || 0,
      basicHealthCoverage: data.cobertura_atencao_basica || 0,
    };
  }
}
```

### 5. Criar Data Collector Service

```typescript
// backend/services/data_collector.ts

import { IBGEAgent } from '../agents/ibge_agent';
import { TesourAgent } from '../agents/tesouro_agent';
import { DATASUSAgent } from '../agents/datasus_agent';

export class DataCollectorService {
  private ibgeAgent: IBGEAgent;
  private tesourAgent: TesourAgent;
  private datausAgent: DATASUSAgent;

  constructor() {
    this.ibgeAgent = new IBGEAgent();
    this.tesourAgent = new TesourAgent();
    this.datausAgent = new DATASUSAgent();
  }

  /**
   * Coletar todos os dados de um município
   */
  async collectMunicipalityData(municipalityId: string) {
    try {
      const [population, fpmBalance, health] = await Promise.all([
        this.ibgeAgent.getPopulation(municipalityId),
        this.tesourAgent.getFPMBalance(municipalityId),
        this.datausAgent.getInfantMortality(municipalityId),
      ]);

      return {
        municipalityId,
        population,
        fpmBalance,
        health,
        collectedAt: new Date(),
      };
    } catch (error) {
      console.error(`Error collecting data for ${municipalityId}:`, error);
      throw error;
    }
  }

  /**
   * Coletar dados de múltiplos municípios em paralelo
   */
  async collectBatchData(municipalityIds: string[]) {
    const results = await Promise.allSettled(
      municipalityIds.map(id => this.collectMunicipalityData(id))
    );

    return {
      successful: results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value),
      failed: results
        .filter(r => r.status === 'rejected')
        .map((r, i) => ({
          municipalityId: municipalityIds[i],
          error: (r as any).reason,
        })),
    };
  }
}
```

## Exemplos de Código

### Usar Data Collector

```typescript
const collector = new DataCollectorService();

// Coletar dados de um município
const data = await collector.collectMunicipalityData('4106902'); // Florianópolis

console.log(data);
// {
//   municipalityId: '4106902',
//   population: { municipalityId: '4106902', population: 500000, ... },
//   fpmBalance: { municipalityCode: '4106902', fpmReceived: 50000000, ... },
//   health: { municipalityCode: '4106902', infantMortality: 15.2, ... },
//   collectedAt: 2024-03-17T...
// }

// Coletar dados de múltiplos municípios
const batchData = await collector.collectBatchData([
  '4106902', // Florianópolis
  '4204402', // Blumenau
  '4202404', // Brusque
]);

console.log(batchData);
// {
//   successful: [...],
//   failed: [...]
// }
```

## Testes

### Teste Unitário

```typescript
// tests/unit/agents/ibge_agent.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IBGEAgent } from '../../../backend/agents/ibge_agent';

describe('IBGEAgent', () => {
  let agent: IBGEAgent;

  beforeEach(() => {
    agent = new IBGEAgent();
  });

  it('should fetch municipality data', async () => {
    const data = await agent.getMunicipalityData('4106902');
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('population');
  });

  it('should normalize data correctly', () => {
    const raw = {
      id: 4106902,
      nome: 'Florianópolis',
      microrregiao: { mesorregiao: { uf: { sigla: 'SC' } } },
      populacao: 500000,
    };

    const normalized = agent.normalize(raw);
    expect(normalized.name).toBe('Florianópolis');
    expect(normalized.population).toBe(500000);
  });

  it('should cache results', async () => {
    const spy = vi.spyOn(agent['client'], 'get');
    
    // Primeira chamada
    await agent.getMunicipalityData('4106902');
    expect(spy).toHaveBeenCalledTimes(1);

    // Segunda chamada (deve vir do cache)
    await agent.getMunicipalityData('4106902');
    expect(spy).toHaveBeenCalledTimes(1); // Não aumentou
  });
});
```

## Troubleshooting

### Problema: Rate Limit Excedido
**Solução:** Aumentar `cacheTTL` e implementar fila de requisições

### Problema: Timeout nas Requisições
**Solução:** Aumentar `timeout` no axios ou implementar circuit breaker

### Problema: Dados Inconsistentes
**Solução:** Validar dados após normalização

## Referências

- [IBGE API Docs](https://servicodados.ibge.gov.br/api/docs/localidades)
- [Tesouro SICONFI](https://siconfi.tesouro.gov.br/)
- [DATASUS](https://datasus.saude.gov.br/)
- [Axios Documentation](https://axios-http.com/)
- [Redis Documentation](https://redis.io/documentation)

---

**Próxima skill:** Data Validation Skill
