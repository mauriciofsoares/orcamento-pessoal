import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Secrets de servidor que jamais podem chegar a um bundle "use client".
const FORBIDDEN_IN_CLIENT_CODE = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
];

const SCAN_ROOTS = ["app", "components"];
const IGNORED_DIRS = new Set(["node_modules", ".next"]);

function collectSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRS.has(entry.name) ? [] : collectSourceFiles(fullPath);
    }

    return /\.(tsx?|jsx?)$/.test(entry.name) ? [fullPath] : [];
  });
}

function isClientFile(source: string) {
  return /^["']use client["'];?/.test(source.trimStart());
}

const clientFiles = SCAN_ROOTS.flatMap(collectSourceFiles).filter((file) =>
  isClientFile(readFileSync(file, "utf8")),
);

describe("secrets nunca aparecem em codigo 'use client'", () => {
  it("encontrou pelo menos um arquivo client para validar (sanity check)", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it.each(clientFiles)("%s nao referencia nenhum secret de servidor", (file) => {
    const source = readFileSync(file, "utf8");

    for (const secretName of FORBIDDEN_IN_CLIENT_CODE) {
      expect(source).not.toContain(secretName);
    }
  });
});

// Basic Auth foi removido (Etapa B2): garante que nao sobrou dependencia ativa
// de APP_PASSWORD/implementacao residual no codigo de producao. Escopo restrito
// aos diretorios de codigo da aplicacao (nao README/tests/.env.example, que sao
// tratados separadamente e podem legitimamente mencionar o historico).
const PRODUCTION_ROOTS = ["app", "components", "lib", "actions", "schemas"];
const productionFiles = [...PRODUCTION_ROOTS.flatMap(collectSourceFiles), "proxy.ts"];

const BASIC_AUTH_RESIDUAL_PATTERNS = [
  "APP_PASSWORD",
  "getBasicPassword",
  "timingSafeEqual",
  "passwordRequiredResponse",
  "appPasswordMissingResponse",
  "Authorization: Basic",
];

describe("Basic Auth removido: nenhuma dependencia ativa de APP_PASSWORD", () => {
  it.each(productionFiles)("%s nao contem residuo de Basic Auth", (file) => {
    const source = readFileSync(file, "utf8");

    for (const pattern of BASIC_AUTH_RESIDUAL_PATTERNS) {
      expect(source).not.toContain(pattern);
    }
  });
});

