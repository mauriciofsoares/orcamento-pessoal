import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseAuth = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: supabaseAuth })),
}));

// Mock funcional (nao um stub vazio): precisamos de status/location/headers reais
// para distinguir pass-through (200) de redirect (302) para /login nos testes abaixo.
vi.mock("next/server", () => {
  class NextResponse {
    status: number;
    headers: Headers;
    cookies = { set: vi.fn() };
    body: unknown;

    constructor(body: unknown = null, init: { status?: number; headers?: HeadersInit } = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this.headers = new Headers(init.headers);
    }

    static next() {
      return new NextResponse(null, { status: 200 });
    }

    static redirect(url: URL) {
      const response = new NextResponse(null, { status: 302 });
      response.headers.set("location", url.toString());
      return response;
    }
  }

  return { NextResponse };
});

import { proxy } from "@/proxy";

function makeRequest(pathname: string, options: { search?: string } = {}) {
  const search = options.search ?? "";

  return {
    url: `https://app.example${pathname}${search}`,
    nextUrl: { pathname, search },
    headers: new Headers(),
    cookies: { getAll: () => [] },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("proxy - rota protegida com usuario autenticado", () => {
  it("permite o acesso (200) quando ha sessao Supabase valida", async () => {
    supabaseAuth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const response = await proxy(makeRequest("/"));

    expect(response.status).toBe(200);
  });

  it("nao redireciona para /login com sessao valida", async () => {
    supabaseAuth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const response = await proxy(makeRequest("/projection"));

    expect(response.status).not.toBe(302);
  });
});

describe("proxy - rota protegida com usuario anonimo", () => {
  it("redireciona para /login quando nao ha sessao", async () => {
    supabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await proxy(makeRequest("/"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.example/login");
  });

  it("preserva a rota original em ?next= para redirecionar de volta apos o login", async () => {
    supabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await proxy(makeRequest("/projection", { search: "?month=2026-09" }));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?next=%2Fprojection%3Fmonth%3D2026-09",
    );
  });

  it("nao adiciona ?next= quando a rota protegida e a propria raiz", async () => {
    supabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await proxy(makeRequest("/"));

    expect(response.headers.get("location")).toBe("https://app.example/login");
  });
});

describe("proxy - sessao invalida/expirada (Casos 1 e 2 da auditoria)", () => {
  it("Caso 1: getUser() retorna { user: null, error: null } -> redireciona para /login", async () => {
    supabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await proxy(makeRequest("/"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.example/login");
  });

  it("Caso 2: getUser() retorna { user: null, error: <erro> } -> redireciona para /login (mesmo comportamento do Caso 1)", async () => {
    supabaseAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid_token"),
    });

    const response = await proxy(makeRequest("/"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.example/login");
  });

  it("getUser() lancando excecao (falha de rede) tambem redireciona para /login, sem erro 500", async () => {
    supabaseAuth.getUser.mockRejectedValue(new Error("network down"));

    const response = await proxy(makeRequest("/"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.example/login");
  });
});

describe("proxy - rota publica com usuario anonimo", () => {
  it("permite acesso (200) sem checar sessao Supabase", async () => {
    const response = await proxy(makeRequest("/login"));

    expect(response.status).toBe(200);
    expect(supabaseAuth.getUser).not.toHaveBeenCalled();
  });
});

