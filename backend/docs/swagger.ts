import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IOC ESG Municipal API",
      version: "1.0.0",
      description:
        "API para scores ODS municipais, simulação de investimento FPM e relatórios ESG. " +
        "Scores de 0–100 calculados a partir de 14 coletores de APIs governamentais públicas.",
    },
    servers: [{ url: "/api", description: "API base" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
          description: "Cookie httpOnly definido no login. Requer CSRF check via Origin/Referer para métodos não-GET.",
        },
      },
      schemas: {
        OdsScore: {
          type: "object",
          properties: {
            odsNumber: { type: "integer", example: 1 },
            odsName: { type: "string", example: "Erradicação da Pobreza" },
            score: { type: "number", format: "float", example: 67.4 },
            color: { type: "string", enum: ["green", "yellow", "red"], example: "yellow" },
            indicators: {
              type: "object",
              additionalProperties: { type: "number" },
              example: { pct_baixa_renda: 22.5 },
            },
            referenceYear: { type: "integer", example: 2023 },
            dataAvailable: { type: "boolean", example: true },
          },
        },
        Municipality: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            ibgeCode: { type: "string", example: "4204202" },
            name: { type: "string", example: "Blumenau" },
            state: { type: "string", example: "SC" },
            population: { type: "integer", example: 361855 },
            region: { type: "string", example: "Sul" },
          },
        },
        SimulationResult: {
          type: "object",
          properties: {
            municipalityId: { type: "string", format: "uuid" },
            investmentAmount: { type: "number", example: 5000000 },
            odsImpacts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  odsNumber: { type: "integer" },
                  currentScore: { type: "number" },
                  projectedScore: { type: "number" },
                  delta: { type: "number" },
                },
              },
            },
            overallDelta: { type: "number", example: 4.2 },
          },
        },
        EsgReport: {
          type: "object",
          properties: {
            municipalityId: { type: "string", format: "uuid" },
            municipalityName: { type: "string" },
            referenceYear: { type: "integer" },
            globalScore: { type: "number" },
            odsScores: {
              type: "array",
              items: { $ref: "#/components/schemas/OdsScore" },
            },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            generatedAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            status: { type: "string", example: "error" },
            message: { type: "string", example: "Recurso não encontrado" },
          },
        },
      },
    },
    paths: {
      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Registrar novo usuário",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "password"],
                  properties: {
                    name: { type: "string", example: "João Silva" },
                    email: { type: "string", format: "email", example: "joao@prefeitura.sc.gov.br" },
                    password: { type: "string", minLength: 8, example: "Senha@2024" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Usuário criado com sucesso",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          name: { type: "string" },
                          email: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Dados inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "409": { description: "Email já cadastrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login — retorna JWT",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email", example: "joao@prefeitura.sc.gov.br" },
                    password: { type: "string", example: "Senha@2024" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Login bem-sucedido. Cookie httpOnly 'token' é definido automaticamente.",
              headers: {
                "Set-Cookie": {
                  description: "Cookie httpOnly 'token' com o JWT de acesso (validade 1 dia)",
                  schema: { type: "string" },
                },
              },
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string", description: "JWT de acesso — inclua como Authorization: Bearer <token> ou use o cookie httpOnly" },
                      refreshToken: { type: "string", description: "Token opaco para renovar o access token via POST /auth/refresh" },
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          name: { type: "string" },
                          email: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Credenciais inválidas", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Retorna dados do usuário autenticado",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          responses: {
            "200": {
              description: "Dados do usuário",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      name: { type: "string" },
                      email: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": { description: "Token ausente ou inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Renova o access token usando um refresh token válido",
          description: "Troca um refresh token por novos access token + refresh token (rotação). O refresh token antigo é revogado imediatamente após o uso.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["refreshToken"],
                  properties: {
                    refreshToken: { type: "string", description: "Refresh token obtido no login ou em uma renovação anterior", example: "eyJhbGciOiJIUzI1NiJ9..." },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Tokens renovados com sucesso",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string", description: "Novo JWT de acesso" },
                      refreshToken: { type: "string", description: "Novo refresh token (o anterior foi revogado)" },
                    },
                  },
                },
              },
            },
            "400": { description: "refreshToken ausente ou inválido no body", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Refresh token expirado, revogado ou inválido", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Encerra a sessão do usuário",
          description: "Revoga o refresh token (se fornecido) e limpa o cookie httpOnly 'token'. O logout é bem-sucedido mesmo se o refresh token não puder ser revogado.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    refreshToken: { type: "string", description: "Refresh token a ser revogado (opcional, mas recomendado para invalidar sessão completamente)" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Logout realizado com sucesso. Cookie 'token' removido.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "Logout realizado com sucesso" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/ods/{ibgeCode}": {
        get: {
          tags: ["ODS"],
          summary: "Scores ODS do município",
          description: "Retorna os 17 scores ODS (0–100) calculados a partir dos 14 coletores governamentais. O resultado é persistido automaticamente no histórico.",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "ibgeCode",
              in: "path",
              required: true,
              schema: { type: "string", pattern: "^\\d{7}$" },
              example: "4204202",
              description: "Código IBGE de 7 dígitos do município",
            },
          ],
          responses: {
            "200": {
              description: "Scores ODS calculados",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ibgeCode: { type: "string" },
                      municipalityName: { type: "string" },
                      globalScore: { type: "number" },
                      scores: {
                        type: "array",
                        items: { $ref: "#/components/schemas/OdsScore" },
                      },
                      calculatedAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            "400": { description: "Código IBGE inválido (deve ter 7 dígitos)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Município não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/ods/compare": {
        post: {
          tags: ["ODS"],
          summary: "Compara ODS entre municípios",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ibgeCodes"],
                  properties: {
                    ibgeCodes: {
                      type: "array",
                      items: { type: "string", pattern: "^\\d{7}$" },
                      minItems: 2,
                      maxItems: 10,
                      example: ["4204202", "4205407"],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Comparativo de scores ODS",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ibgeCode: { type: "string" },
                        municipalityName: { type: "string" },
                        globalScore: { type: "number" },
                        scores: { type: "array", items: { $ref: "#/components/schemas/OdsScore" } },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/simulator/simulate": {
        post: {
          tags: ["Simulador"],
          summary: "Simular impacto de investimento FPM nos ODS",
          description: "Projeta o impacto de um investimento em políticas públicas nos scores ODS do município. A alocação deve somar exatamente 100%.",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ibgeCode", "totalAmount", "allocation"],
                  properties: {
                    ibgeCode: { type: "string", pattern: "^\\d{7}$", example: "4204202" },
                    totalAmount: { type: "number", description: "Valor total a investir em reais", example: 5000000 },
                    allocation: {
                      type: "object",
                      description: "Percentual por área de investimento. A soma de todos os campos DEVE ser exatamente 100 (tolerância ±0.01).",
                      required: ["education", "health", "sanitation", "environment", "security", "energy", "urbanization", "governance"],
                      properties: {
                        education:    { type: "number", minimum: 0, maximum: 100, example: 30 },
                        health:       { type: "number", minimum: 0, maximum: 100, example: 20 },
                        sanitation:   { type: "number", minimum: 0, maximum: 100, example: 15 },
                        environment:  { type: "number", minimum: 0, maximum: 100, example: 10 },
                        security:     { type: "number", minimum: 0, maximum: 100, example: 5 },
                        energy:       { type: "number", minimum: 0, maximum: 100, example: 5 },
                        urbanization: { type: "number", minimum: 0, maximum: 100, example: 10 },
                        governance:   { type: "number", minimum: 0, maximum: 100, example: 5 },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Resultado da simulação",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SimulationResult" },
                },
              },
            },
            "400": { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Município não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/simulator/compare": {
        post: {
          tags: ["Simulador"],
          summary: "Compara cenários de simulação de investimento",
          description: "Executa múltiplos cenários em paralelo. Body é um array direto de SimulationInput (mín 2, máx 5). Cada cenário deve ter allocation somando 100%.",
          security: [{ bearerAuth: [] }, { cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  minItems: 2,
                  maxItems: 5,
                  items: {
                    type: "object",
                    required: ["ibgeCode", "totalAmount", "allocation"],
                    properties: {
                      ibgeCode: { type: "string", pattern: "^\\d{7}$", example: "4204202" },
                      totalAmount: { type: "number", example: 3000000 },
                      allocation: {
                        type: "object",
                        description: "Percentual por área — soma deve ser 100%",
                        required: ["education", "health", "sanitation", "environment", "security", "energy", "urbanization", "governance"],
                        properties: {
                          education:    { type: "number", minimum: 0, maximum: 100 },
                          health:       { type: "number", minimum: 0, maximum: 100 },
                          sanitation:   { type: "number", minimum: 0, maximum: 100 },
                          environment:  { type: "number", minimum: 0, maximum: 100 },
                          security:     { type: "number", minimum: 0, maximum: 100 },
                          energy:       { type: "number", minimum: 0, maximum: 100 },
                          urbanization: { type: "number", minimum: 0, maximum: 100 },
                          governance:   { type: "number", minimum: 0, maximum: 100 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Comparativo de cenários",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        result: { $ref: "#/components/schemas/SimulationResult" },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/reports/{ibgeCode}": {
        get: {
          tags: ["Relatórios"],
          summary: "Relatório ESG executivo completo do município",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "ibgeCode",
              in: "path",
              required: true,
              schema: { type: "string", pattern: "^\\d{7}$" },
              example: "4204202",
            },
          ],
          responses: {
            "200": {
              description: "Relatório ESG com scores, indicadores e recomendações",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EsgReport" },
                },
              },
            },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Município não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/benchmarks": {
        post: {
          tags: ["Benchmarks"],
          summary: "Benchmark de múltiplos municípios",
          description: "Retorna ranking, médias e comparativo de scores ODS entre os municípios informados.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ibgeCodes"],
                  properties: {
                    ibgeCodes: {
                      type: "array",
                      items: { type: "string", pattern: "^\\d{7}$" },
                      minItems: 2,
                      example: ["4204202", "4205407", "4209102"],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Resultado do benchmark",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ranking: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            position: { type: "integer" },
                            ibgeCode: { type: "string" },
                            municipalityName: { type: "string" },
                            globalScore: { type: "number" },
                          },
                        },
                      },
                      averageScore: { type: "number" },
                      topOds: { type: "integer", description: "ODS com melhor score médio" },
                      bottomOds: { type: "integer", description: "ODS com pior score médio" },
                    },
                  },
                },
              },
            },
            "400": { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/benchmarks/compare": {
        post: {
          tags: ["Benchmarks"],
          summary: "Compara município vs grupo de referência",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ibgeCode", "groupIbgeCodes"],
                  properties: {
                    ibgeCode: { type: "string", pattern: "^\\d{7}$", example: "4204202", description: "Município a ser comparado" },
                    groupIbgeCodes: {
                      type: "array",
                      items: { type: "string", pattern: "^\\d{7}$" },
                      description: "Grupo de referência para comparação",
                      example: ["4205407", "4209102", "4218707"],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Comparativo município vs grupo",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      municipality: {
                        type: "object",
                        properties: {
                          ibgeCode: { type: "string" },
                          name: { type: "string" },
                          globalScore: { type: "number" },
                          scores: { type: "array", items: { $ref: "#/components/schemas/OdsScore" } },
                        },
                      },
                      groupAverage: {
                        type: "object",
                        properties: {
                          globalScore: { type: "number" },
                          scores: { type: "array", items: { $ref: "#/components/schemas/OdsScore" } },
                        },
                      },
                      deltas: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            odsNumber: { type: "integer" },
                            delta: { type: "number", description: "Diferença em relação à média do grupo" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "Parâmetros inválidos", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/municipalities": {
        get: {
          tags: ["Municípios"],
          summary: "Lista municípios (paginado)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Página (inicia em 1)" },
            { name: "pageSize", in: "query", schema: { type: "integer", default: 50, maximum: 100 }, description: "Resultados por página (máx 100)" },
            { name: "state", in: "query", schema: { type: "string" }, example: "SC", description: "Filtrar por UF" },
          ],
          responses: {
            "200": {
              description: "Lista paginada de municípios",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Municipality" },
                      },
                      total: { type: "integer" },
                      page: { type: "integer" },
                      pageSize: { type: "integer" },
                    },
                  },
                },
              },
            },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/municipalities/{ibgeCode}": {
        get: {
          tags: ["Municípios"],
          summary: "Detalhe de um município",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "ibgeCode",
              in: "path",
              required: true,
              schema: { type: "string", pattern: "^\\d{7}$" },
              example: "4204202",
            },
          ],
          responses: {
            "200": {
              description: "Dados do município",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Municipality" },
                },
              },
            },
            "401": { description: "Não autenticado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "Município não encontrado", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
