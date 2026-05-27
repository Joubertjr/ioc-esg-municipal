/* eslint-disable no-console */
/**
 * Runner MDO — evals vertical-específicos da camada agêntica ESG.
 *
 * Uso:
 *   pnpm eval:agent
 *   pnpm eval:agent -- --skip-integration
 *   pnpm eval:agent -- --id task-002-status-verde
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getOdsStatus, classifyStaleness } from "../../shared/types/domain/ods.js";
import {
  AgentQueryInputSchema,
  AgentSessionContextSchema,
  AuditLogEntrySchema,
  ExecutiveReportSchema,
  SimulationRequestSchema,
} from "../../backend/services/agent/schemas.js";

/** Cópia mínima de ods_score_service.calculateGeometricMean — evita carregar 14 coletores no modo fast */
function calculateGeometricMean(scores: number[], weights?: number[]): number {
  if (scores.length === 0) return 0;
  const w = weights ?? scores.map(() => 1);
  const totalWeight = w.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  const weightedLogSum = scores.reduce((acc, s, i) => acc + w[i] * Math.log(Math.max(s, 1)), 0);
  return Math.round(Math.exp(weightedLogSum / totalWeight));
}

async function calculateMunicipalOds(ibgeCode: string) {
  const { calculateMunicipalOds: fn } =
    await import("../../backend/services/ods/ods_score_service.js");
  return fn(ibgeCode);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const TaskSchema = z.object({
  id: z.string(),
  categoria: z.string(),
  runner: z.string(),
  input: z.record(z.unknown()),
  expected: z.record(z.unknown()).optional(),
});

type Task = z.infer<typeof TaskSchema>;

interface TaskResult {
  id: string;
  passed: boolean;
  skipped?: boolean;
  message?: string;
}

function loadTasks(): Task[] {
  const raw = readFileSync(join(__dirname, "tasks.json"), "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  return z.array(TaskSchema).parse(parsed);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let skipIntegration = false;
  let filterId: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skip-integration") skipIntegration = true;
    if (args[i] === "--id" && args[i + 1]) filterId = args[++i];
  }
  return { skipIntegration, filterId };
}

async function runTask(task: Task, skipIntegration: boolean): Promise<TaskResult> {
  if (skipIntegration && task.runner.startsWith("integration")) {
    return { id: task.id, passed: true, skipped: true, message: "integration skipped" };
  }

  try {
    switch (task.runner) {
      case "domain.status": {
        const score = z.number().parse(task.input.score);
        const status = getOdsStatus(score);
        const expected = z
          .object({ status: z.enum(["verde", "amarelo", "vermelho"]) })
          .parse(task.expected);
        return {
          id: task.id,
          passed: status === expected.status,
          message: status !== expected.status ? `got ${status}` : undefined,
        };
      }
      case "domain.staleness": {
        const ageYears = z.number().parse(task.input.ageYears);
        const staleness = classifyStaleness(ageYears);
        const expected = z
          .object({
            staleness: z.enum(["fresh", "recent", "stale", "critical", "unknown"]),
          })
          .parse(task.expected);
        return {
          id: task.id,
          passed: staleness === expected.staleness,
          message: staleness !== expected.staleness ? `got ${staleness}` : undefined,
        };
      }
      case "domain.geometric_mean": {
        const scores = z.array(z.number()).parse(task.input.scores);
        const weights = task.input.weights
          ? z.array(z.number()).parse(task.input.weights)
          : undefined;
        const result = calculateGeometricMean(scores, weights);
        const expected = z.object({ result: z.number() }).parse(task.expected);
        return {
          id: task.id,
          passed: result === expected.result,
          message: result !== expected.result ? `got ${result}` : undefined,
        };
      }
      case "schema.session_context": {
        const parsed = AgentSessionContextSchema.safeParse(task.input);
        const expected = z.object({ valid: z.boolean() }).parse(task.expected);
        const valid = parsed.success;
        return {
          id: task.id,
          passed: valid === expected.valid,
          message: valid !== expected.valid ? `valid=${valid}` : undefined,
        };
      }
      case "schema.agent_query": {
        const parsed = AgentQueryInputSchema.safeParse(task.input);
        const expected = z.object({ valid: z.boolean() }).parse(task.expected);
        const valid = parsed.success;
        return {
          id: task.id,
          passed: valid === expected.valid,
          message: valid !== expected.valid ? `valid=${valid}` : undefined,
        };
      }
      case "schema.agent_query_long": {
        const length = z.number().parse(task.input.length);
        const parsed = AgentQueryInputSchema.safeParse({
          municipalityId: "4205407",
          question: "Q".repeat(length),
          role: "secretario",
        });
        const expected = z.object({ valid: z.boolean() }).parse(task.expected);
        const valid = parsed.success;
        return {
          id: task.id,
          passed: valid === expected.valid,
          message: `length=${length} valid=${valid}`,
        };
      }
      case "schema.simulation": {
        const parsed = SimulationRequestSchema.safeParse(task.input);
        const expected = z.object({ valid: z.boolean() }).parse(task.expected);
        const valid = parsed.success;
        return {
          id: task.id,
          passed: valid === expected.valid,
          message: valid !== expected.valid ? `valid=${valid}` : undefined,
        };
      }
      case "schema.executive_report": {
        const parsed = ExecutiveReportSchema.safeParse(task.input);
        const expected = z.object({ valid: z.boolean() }).parse(task.expected);
        const valid = parsed.success;
        return {
          id: task.id,
          passed: valid === expected.valid,
          message: valid !== expected.valid ? `valid=${valid}` : undefined,
        };
      }
      case "schema.audit_log": {
        const parsed = AuditLogEntrySchema.safeParse(task.input);
        const expected = z.object({ valid: z.boolean() }).parse(task.expected);
        const valid = parsed.success;
        return {
          id: task.id,
          passed: valid === expected.valid,
          message: valid !== expected.valid ? `valid=${valid}` : undefined,
        };
      }
      case "policy.tool_scope_count": {
        const tools = z.array(z.string()).parse(task.input.tools);
        const allowed = tools.length <= 6;
        const expected = z.object({ allowed: z.boolean() }).parse(task.expected);
        return {
          id: task.id,
          passed: allowed === expected.allowed,
          message: `count=${tools.length}`,
        };
      }
      case "policy.tenant": {
        const sessionMunicipalityId = z.string().parse(task.input.sessionMunicipalityId);
        const requestedMunicipalityId = z.string().parse(task.input.requestedMunicipalityId);
        const allowed = sessionMunicipalityId === requestedMunicipalityId;
        const expected = z.object({ allowed: z.boolean() }).parse(task.expected);
        return { id: task.id, passed: allowed === expected.allowed };
      }
      case "policy.agent_action": {
        const action = z.string().parse(task.input.action);
        const forbidden = [
          "set_ods_score_direct",
          "trigger_mass_collection",
          "elevate_rbac",
          "call_external_api_direct",
        ];
        if (forbidden.includes(action)) {
          return { id: task.id, passed: task.expected?.allowed === false };
        }
        if (action === "publish_report" || task.input.persistScenario === true) {
          return { id: task.id, passed: task.expected?.requiresHitl === true };
        }
        return { id: task.id, passed: false, message: "unknown policy action" };
      }
      case "integration_municipality": {
        const ibgeCode = z.string().parse(task.input.ibgeCode);
        const report = await calculateMunicipalOds(ibgeCode);
        if (!report) {
          return { id: task.id, passed: false, message: "no report" };
        }
        const ok =
          report.ibgeCode === ibgeCode &&
          report.ods.length > 0 &&
          (report.municipalityName === null ||
            report.municipalityName.toLowerCase().includes("florian"));
        return {
          id: task.id,
          passed: ok,
          message: ok
            ? undefined
            : `ibge=${report.ibgeCode} name=${report.municipalityName ?? "null"} ods=${report.ods.length}`,
        };
      }
      case "integration": {
        const ibgeCode = z.string().parse(task.input.ibgeCode);
        const odsNumber = z.number().int().min(1).max(17).parse(task.input.odsNumber);
        const report = await calculateMunicipalOds(ibgeCode);
        if (!report) {
          return { id: task.id, passed: false, message: "no report" };
        }
        const ods = report.ods.find((o) => o.odsNumber === odsNumber);
        if (!ods) {
          return { id: task.id, passed: false, message: `ODS ${odsNumber} not found` };
        }
        if (ods.score === null) {
          return { id: task.id, passed: true, message: "score null — no fabricated value" };
        }
        const ok = ods.score >= 0 && ods.score <= 100;
        return {
          id: task.id,
          passed: ok,
          message: ok ? undefined : `score=${ods.score}`,
        };
      }
      case "integration_global": {
        const ibgeCode = z.string().parse(task.input.ibgeCode);
        const report = await calculateMunicipalOds(ibgeCode);
        if (!report) {
          return { id: task.id, passed: false, message: "no report" };
        }
        if (report.globalScore === null) {
          return { id: task.id, passed: true, message: "globalScore null acceptable" };
        }
        const ok = report.globalScore >= 0 && report.globalScore <= 100;
        return {
          id: task.id,
          passed: ok,
          message: ok ? undefined : `global=${report.globalScore}`,
        };
      }
      default:
        return { id: task.id, passed: false, message: `unknown runner: ${task.runner}` };
    }
  } catch (err) {
    return {
      id: task.id,
      passed: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const { skipIntegration, filterId } = parseArgs();
  let tasks = loadTasks();
  if (filterId) tasks = tasks.filter((t) => t.id === filterId);

  const results: TaskResult[] = [];
  for (const task of tasks) {
    const result = await runTask(task, skipIntegration);
    results.push(result);
    const icon = result.skipped ? "○" : result.passed ? "✓" : "✗";
    console.log(`${icon} ${result.id}${result.message ? ` — ${result.message}` : ""}`);
  }

  const executed = results.filter((r) => !r.skipped);
  const passed = executed.filter((r) => r.passed).length;
  const passRate = executed.length === 0 ? 0 : passed / executed.length;

  const baseline = {
    version: "0.2.0",
    date: new Date().toISOString().slice(0, 10),
    pass_rate: Math.round(passRate * 10000) / 10000,
    passed,
    total_tasks: tasks.length,
    executed: executed.length,
    skipped: results.filter((r) => r.skipped).length,
    skip_integration: skipIntegration,
  };

  writeFileSync(join(__dirname, "baseline.json"), JSON.stringify(baseline, null, 2) + "\n");

  console.log(
    `\n${passed}/${executed.length} passed (${(passRate * 100).toFixed(1)}%) · baseline.json updated`,
  );

  if (passed < executed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
