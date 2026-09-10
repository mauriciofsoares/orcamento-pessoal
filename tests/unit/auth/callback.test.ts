import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  auth: { exchangeCodeForSession: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabase),
}));

vi.mock("next/server", () => {
  class NextResponse {
    static redirect(url: URL) {
      return { redirected: true, location: url.toString() };
    }
  }

  return { NextResponse };
});

import { GET } from "@/app/auth/callback/route";

function makeRequest(url: string) {
  return { url, nextUrl: { origin: new URL(url).origin } } as never;
}

type RedirectResult = { redirected: true; location: string };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /auth/callback - code valido", () => {
  it("troca o code por sessao e redireciona para o destino (next) esperado", async () => {
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = (await GET(
      makeRequest("https://app.example/auth/callback?code=abc123&next=/projection"),
    )) as unknown as RedirectResult;

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.location).toBe("https://app.example/projection");
  });

  it("redireciona para a raiz quando next esta ausente", async () => {
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = (await GET(
      makeRequest("https://app.example/auth/callback?code=abc123"),
    )) as unknown as RedirectResult;

    expect(response.location).toBe("https://app.example/");
  });
});

describe("GET /auth/callback - sem code", () => {
  it("nao chama exchangeCodeForSession e redireciona para /login com erro", async () => {
    const response = (await GET(
      makeRequest("https://app.example/auth/callback"),
    )) as unknown as RedirectResult;

    expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.location).toBe("https://app.example/login?error=auth_callback");
  });
});

describe("GET /auth/callback - erro no exchange", () => {
  it("redireciona para /login com erro quando exchangeCodeForSession falha", async () => {
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      error: new Error("invalid_grant"),
    });

    const response = (await GET(
      makeRequest("https://app.example/auth/callback?code=invalido"),
    )) as unknown as RedirectResult;

    expect(response.location).toBe("https://app.example/login?error=auth_callback");
  });
});

describe("GET /auth/callback - protecao contra open redirect via next", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    "http://evil.example",
    "javascript:alert(1)",
    "/\\evil.example",
    "\\evil.example",
  ])("ignora next malicioso (%s) e redireciona para a raiz do proprio site", async (maliciousNext) => {
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = (await GET(
      makeRequest(
        `https://app.example/auth/callback?code=abc123&next=${encodeURIComponent(maliciousNext)}`,
      ),
    )) as unknown as RedirectResult;

    expect(response.location).toBe("https://app.example/");
  });

  it.each(["/", "/transactions", "/alguma-rota"])(
    "mantem caminhos internos seguros (%s)",
    async (safeNext) => {
      supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });

      const response = (await GET(
        makeRequest(`https://app.example/auth/callback?code=abc123&next=${encodeURIComponent(safeNext)}`),
      )) as unknown as RedirectResult;

      expect(response.location).toBe(`https://app.example${safeNext}`);
    },
  );
});
