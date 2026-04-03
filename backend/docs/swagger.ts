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
              description: "Login bem-sucedido",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string", description: "JWT — inclua como Authorization: Bearer <token>" },
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
          security: [{ bearerAuth: [] }],
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
          description: "Projeta o impacto de um investimento em políticas públicas nos scores ODS do município.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ibgeCode", "investmentAmount", "targetOds"],
                  properties: {
                    ibgeCode: { type: "string", pattern: "^\\d{7}$", example: "4204202" },
                    investmentAmount: { type: "number", description: "Valor em reais", example: 5000000 },
                    targetOds: {
                      type: "array",
                      items: { type: "integer", minimum: 1, maximum: 17 },
                      example: [3, 4, 6],
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
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ibgeCode", "scenarios"],
                  properties: {
                    ibgeCode: { type: "string", pattern: "^\\d{7}$", example: "4204202" },
                    scenarios: {
                      type: "array",
                      minItems: 2,
                      items: {
                        type: "object",
                        required: ["label", "investmentAmount", "targetOds"],
                        properties: {
                          label: { type: "string", example: "Foco em Saúde" },
                          investmentAmount: { type: "number", example: 3000000 },
                          targetOds: { type: "array", items: { type: "integer" }, example: [3] },
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
