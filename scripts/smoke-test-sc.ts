#!/usr/bin/env npx tsx
/**
 * scripts/smoke-test-sc.ts
 *
 * Smoke test de liberação para os 295 municípios de SC.
 * Valida: ambiente, canários, benchmark codes, varredura global, peers, ingestion.
 * Gera evidências em docs/evidence/YYYY-MM-DD-smoke-final/
 *
 * Uso: npx tsx scripts/smoke-test-sc.ts [baseUrl]
 *       baseUrl default: http://localhost:3000
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.SMOKE_EMAIL ?? "admin@ioc.local";
const ADMIN_PASSWORD = process.env.SMOKE_PASSWORD ?? "Admin@2026";

const CANARY_CODES = ["4205407", "4209102", "4209300", "4202453", "4204202"];

const EXPECTED_BENCHMARK_NAMES: Record<string, string> = {
  "4205407": "Florianópolis",
  "4209102": "Joinville",
  "4202404": "Blumenau",
  "4204608": "Criciúma",
  "4216602": "São José",
  "4209300": "Lages",
  "4202008": "Balneário Camboriú",
  "4204202": "Chapecó",
  "4208203": "Itajaí",
  "4211900": "Palhoça",
};

const BENCHMARK_CODES = Object.keys(EXPECTED_BENCHMARK_NAMES);

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
  durationMs: number;
}

interface Summary {
  timestamp: string;
  baseUrl: string;
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  verdict: "GO" | "NO-GO";
}

// ─── State ───────────────────────────────────────────────────────────────────

const results: TestResult[] = [];
let token = "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function record(name: string, pass: boolean, detail: string, startMs: number): void {
  const durationMs = Date.now() - startMs;
  results.push({ name, pass, detail, durationMs });
  const icon = pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`  [${icon}] ${name} (${durationMs}ms) ${pass ? "" : "— " + detail}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Smoke 0: Ambiente ───────────────────────────────────────────────────────

async function smoke0(): Promise<void> {
  console.log("\n=== Smoke 0: Ambiente ===");

  // Health
  let t = Date.now();
  const { status: hStatus, data: hData } = await api("GET", "/health");
  const hOk = hStatus === 200 && (hData as { status: string })?.status === "ok";
  record("health", hOk, `HTTP ${hStatus}`, t);

  // Login
  t = Date.now();
  const { status: lStatus, data: lData } = await api("POST", "/api/auth/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const loginObj = lData as { token?: string; refreshToken?: string; user?: { role?: string } };
  const loginOk = lStatus === 200 && !!loginObj?.token;
  if (loginOk) token = loginObj.token!;
  record("login", loginOk, loginOk ? `role=${loginObj?.user?.role}` : `HTTP ${lStatus}`, t);

  // 295 municipalities
  t = Date.now();
  const { status: mStatus, data: mData } = await api(
    "GET",
    "/api/municipalities?limit=500&pageSize=300",
  );
  const mObj = mData as { total?: number };
  const mOk = mStatus === 200 && mObj?.total === 295;
  record("295 municipalities", mOk, `total=${mObj?.total}`, t);
}

// ─── Smoke 1: Canários ──────────────────────────────────────────────────────

async function smoke1(): Promise<void> {
  console.log("\n=== Smoke 1: Canários (5 municípios) ===");

  for (const code of CANARY_CODES) {
    // ODS
    let t = Date.now();
    const { status: oStatus, data: oData } = await api("GET", `/api/ods/${code}`);
    const oObj = oData as {
      globalScore?: number | null;
      geometricScore?: number | null;
      dataSource?: string;
      odsCount?: { withData?: number };
      ods?: Array<{ odsNumber: number }>;
    };
    const oOk =
      oStatus === 200 &&
      oObj?.globalScore !== null &&
      oObj?.globalScore !== undefined &&
      oObj?.globalScore > 0 &&
      typeof oObj?.dataSource === "string" &&
      (oObj?.ods?.length ?? 0) === 17;
    record(
      `ods/${code}`,
      oOk,
      `score=${oObj?.globalScore} geometric=${oObj?.geometricScore} src=${oObj?.dataSource} ods=${oObj?.ods?.length}`,
      t,
    );

    // Peers
    t = Date.now();
    const { status: pStatus, data: pData } = await api("GET", `/api/municipalities/${code}/peers`);
    const pObj = pData as { peers?: string[]; peerCount?: number };
    const pOk =
      pStatus === 200 && (pObj?.peerCount ?? 0) > 0 && !(pObj?.peers ?? []).includes(code);
    record(
      `peers/${code}`,
      pOk,
      `count=${pObj?.peerCount} self=${(pObj?.peers ?? []).includes(code)}`,
      t,
    );

    // History (only for first canary to save rate limit)
    if (code === CANARY_CODES[0]) {
      t = Date.now();
      const { status: hStatus, data: hData } = await api(
        "GET",
        `/api/ods/${code}/history?odsNumber=0`,
      );
      const hObj = hData as { history?: Array<{ odsNumber: number; score: number | null }> };
      const allOds0 = (hObj?.history ?? []).every((h) => h.odsNumber === 0);
      const hasScore = (hObj?.history ?? []).some((h) => h.score !== null);
      const hOk = hStatus === 200 && allOds0 && hasScore;
      record(
        `history/${code} odsNumber=0`,
        hOk,
        `entries=${hObj?.history?.length} allOds0=${allOds0} hasScore=${hasScore}`,
        t,
      );
    }
  }
}

// ─── Smoke 2: Benchmark Codes ────────────────────────────────────────────────

async function smoke2(): Promise<void> {
  console.log("\n=== Smoke 2: Benchmark Codes (10 SC) ===");

  const t = Date.now();
  const { status, data } = await api("POST", "/api/benchmarks", {
    ibgeCodes: BENCHMARK_CODES,
  });
  const obj = data as {
    municipalityCount?: number;
    municipalities?: Array<{
      ibgeCode: string;
      municipalityName: string;
      globalScore: number | null;
    }>;
  };

  const countOk = status === 200 && obj?.municipalityCount === 10;
  record("benchmark count", countOk, `count=${obj?.municipalityCount}`, t);

  // Validate each code → name mapping
  const munis = obj?.municipalities ?? [];
  let nameErrors = 0;
  for (const [code, expectedName] of Object.entries(EXPECTED_BENCHMARK_NAMES)) {
    const found = munis.find((m) => m.ibgeCode === code);
    if (!found || found.municipalityName !== expectedName) {
      nameErrors++;
      record(
        `benchmark name ${code}`,
        false,
        `expected=${expectedName} got=${found?.municipalityName ?? "NOT FOUND"}`,
        t,
      );
    }
  }
  if (nameErrors === 0) {
    record("benchmark names 10/10", true, "all match", t);
  }
}

// ─── Smoke 3: Varredura 295 (single benchmark request) ──────────────────────

async function smoke3(): Promise<void> {
  console.log("\n=== Smoke 3: Varredura 295 municípios ===");

  // Get all IBGE codes
  const t0 = Date.now();
  const { data: mData } = await api("GET", "/api/municipalities?limit=500&pageSize=300");
  const allCodes: string[] = ((mData as { data?: Array<{ ibgeCode: string }> })?.data ?? []).map(
    (m) => m.ibgeCode,
  );
  record("fetch all codes", allCodes.length === 295, `got=${allCodes.length}`, t0);

  if (allCodes.length === 0) return;

  // POST /api/benchmarks with all 295 (limit is 300)
  const t1 = Date.now();
  const { status, data } = await api("POST", "/api/benchmarks", {
    ibgeCodes: allCodes,
  });
  const obj = data as {
    municipalityCount?: number;
    municipalities?: Array<{
      ibgeCode: string;
      municipalityName: string;
      globalScore: number | null;
    }>;
  };

  record(
    "benchmark 295 response",
    status === 200,
    `HTTP ${status} count=${obj?.municipalityCount}`,
    t1,
  );

  const munis = obj?.municipalities ?? [];
  const withScore = munis.filter((m) => m.globalScore !== null && m.globalScore > 0);
  const withoutScore = munis.filter((m) => m.globalScore === null || m.globalScore === 0);

  record(
    "295 globalScore coverage",
    withScore.length >= 280,
    `withScore=${withScore.length}/295 missing=${withoutScore.length}`,
    t1,
  );

  if (withoutScore.length > 0 && withoutScore.length <= 15) {
    console.log(
      `    Missing scores: ${withoutScore.map((m) => `${m.ibgeCode}(${m.municipalityName})`).join(", ")}`,
    );
  }
}

// ─── Smoke 4: Peers 295 (throttled) ─────────────────────────────────────────

async function smoke4(): Promise<void> {
  console.log("\n=== Smoke 4: Peers 295 municípios (throttled 50/min) ===");

  const { data: mData } = await api("GET", "/api/municipalities?limit=500&pageSize=300");
  const allCodes: string[] = ((mData as { data?: Array<{ ibgeCode: string }> })?.data ?? []).map(
    (m) => m.ibgeCode,
  );

  if (allCodes.length === 0) {
    record("peers 295", false, "no municipality codes", Date.now());
    return;
  }

  const t0 = Date.now();
  let passCount = 0;
  let failCount = 0;
  const failCodes: string[] = [];

  for (let i = 0; i < allCodes.length; i++) {
    const code = allCodes[i];
    const { status, data } = await api("GET", `/api/municipalities/${code}/peers`);
    const obj = data as { peers?: string[]; peerCount?: number };

    if (status === 200 && (obj?.peerCount ?? 0) > 0 && !(obj?.peers ?? []).includes(code)) {
      passCount++;
    } else if (status === 429) {
      // Rate limited — wait and retry once
      await sleep(62_000);
      const retry = await api("GET", `/api/municipalities/${code}/peers`);
      const retryObj = retry.data as { peers?: string[]; peerCount?: number };
      if (
        retry.status === 200 &&
        (retryObj?.peerCount ?? 0) > 0 &&
        !(retryObj?.peers ?? []).includes(code)
      ) {
        passCount++;
      } else {
        failCount++;
        failCodes.push(code);
      }
    } else {
      failCount++;
      failCodes.push(code);
    }

    // Throttle: pause every 45 requests to stay under 60 req/min
    if ((i + 1) % 45 === 0 && i < allCodes.length - 1) {
      process.stdout.write(
        `    ... ${i + 1}/${allCodes.length} (${passCount} pass, ${failCount} fail) — throttling...\r`,
      );
      await sleep(62_000);
    }
  }

  console.log(`    Final: ${passCount} pass, ${failCount} fail out of ${allCodes.length}`);
  record(
    "peers 295 coverage",
    passCount >= 290,
    `pass=${passCount} fail=${failCount} failCodes=${failCodes.slice(0, 10).join(",")}`,
    t0,
  );
}

// ─── Smoke 5: Ingestion ─────────────────────────────────────────────────────

async function smoke5(): Promise<void> {
  console.log("\n=== Smoke 5: Ingestion Status ===");

  const t = Date.now();
  const { status, data } = await api("GET", "/api/ingestion/status");
  const obj = data as {
    lastRuns?: Array<{ source: string; status: string; successCount?: number }>;
    nextScheduledAt?: string;
    isRunning?: boolean;
  };

  const runs = obj?.lastRuns ?? [];
  const completedRuns = runs.filter((r) => r.status === "completed" || r.status === "partial");
  const hasSchedule = !!obj?.nextScheduledAt;

  record(
    "ingestion status",
    status === 200 && completedRuns.length > 0,
    `runs=${runs.length} completed=${completedRuns.length} scheduled=${hasSchedule}`,
    t,
  );

  if (completedRuns.length > 0) {
    console.log(
      `    Sources: ${completedRuns.map((r) => `${r.source}(${r.status}, ${r.successCount ?? "?"}ok)`).join(", ")}`,
    );
  }
}

// ─── Evidence Generation ─────────────────────────────────────────────────────

function generateEvidence(): Summary {
  const today = new Date().toISOString().slice(0, 10);
  const dir = join(process.cwd(), "docs", "evidence", `${today}-smoke-final`);
  mkdirSync(dir, { recursive: true });

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const totalMs = results.reduce((acc, r) => acc + r.durationMs, 0);
  const verdict: "GO" | "NO-GO" = failed === 0 ? "GO" : "NO-GO";

  const summary: Summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: results.length,
    passed,
    failed,
    durationMs: totalMs,
    verdict,
  };

  // summary.json
  writeFileSync(join(dir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");

  // failures.json
  const failures = results.filter((r) => !r.pass);
  writeFileSync(join(dir, "failures.json"), JSON.stringify(failures, null, 2) + "\n");

  // REPORT.md
  const lines: string[] = [
    `# Smoke Test Final SC — ${today}`,
    "",
    `**Veredicto: ${verdict}**`,
    "",
    `| Métrica | Valor |`,
    `|---|---|`,
    `| Total testes | ${results.length} |`,
    `| Passed | ${passed} |`,
    `| Failed | ${failed} |`,
    `| Duracão total | ${(totalMs / 1000).toFixed(1)}s |`,
    `| Base URL | ${BASE_URL} |`,
    "",
    "## Resultados",
    "",
    "| # | Teste | Status | Detalhe | Tempo |",
    "|---|-------|--------|---------|-------|",
  ];

  results.forEach((r, i) => {
    const status = r.pass ? "PASS" : "**FAIL**";
    lines.push(`| ${i + 1} | ${r.name} | ${status} | ${r.detail} | ${r.durationMs}ms |`);
  });

  if (failures.length > 0) {
    lines.push("", "## Falhas", "");
    for (const f of failures) {
      lines.push(`- **${f.name}**: ${f.detail}`);
    }
  }

  lines.push("");
  writeFileSync(join(dir, "REPORT.md"), lines.join("\n"));

  console.log(`\nEvidence saved to: ${dir}/`);
  return summary;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nSmoke Test Final SC — ${BASE_URL}`);
  console.log("=".repeat(60));

  const startTime = Date.now();

  try {
    await smoke0();
    if (!token) {
      console.error("\nFATAL: Login failed, cannot proceed.");
      process.exit(1);
    }
    await smoke1();
    await smoke2();
    await smoke3();
    await smoke4();
    await smoke5();
  } catch (err) {
    console.error("\nFATAL:", err);
    results.push({
      name: "uncaught error",
      pass: false,
      detail: String(err),
      durationMs: Date.now() - startTime,
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total time: ${elapsed}s`);

  const summary = generateEvidence();

  const icon = summary.verdict === "GO" ? "\x1b[32m" : "\x1b[31m";
  console.log(`\n${icon}${summary.verdict}\x1b[0m — ${summary.passed}/${summary.total} passed\n`);

  process.exit(summary.verdict === "GO" ? 0 : 1);
}

void main();
