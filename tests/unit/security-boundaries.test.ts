import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/server", () => ({
  NextResponse: class NextResponse {},
}));

import { getRequestOrigin, safeNextPath } from "@/app/auth/callback/route";
import { isPublicAuthPath, isPublicPath } from "@/proxy";

const serviceWorkerSource = readFileSync("public/sw.js", "utf8");

describe("auth callback redirect boundaries", () => {
  it.each(["/", "/projection", "/projection?month=2026-09"])(
    "accepts internal path %s",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    "//evil.example",
    "///evil.example",
    "https://evil.example",
    "http://evil.example",
    "javascript:alert(1)",
    "data:text/html,<h1>evil</h1>",
    "/\\evil.example",
    "\\evil.example",
  ])(
    "rejects external or alternate URL %s",
    (path) => {
      expect(safeNextPath(path)).toBe("/");
    },
  );

  it("keeps an encoded slash path on the application origin", () => {
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
});

describe("auth callback origin", () => {
  const request = (origin: string, headers: Record<string, string> = {}) =>
    ({
      nextUrl: { origin },
      headers: new Headers(headers),
    }) as never;

  it("uses a valid configured site origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://orcamento.example");

    expect(
      getRequestOrigin(request("http://request.example", {
        host: "evil.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "http",
      })),
    ).toBe("https://orcamento.example");
    vi.unstubAllEnvs();
  });

  it("falls back to request.nextUrl.origin for invalid configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "javascript:alert(1)");

    expect(
      getRequestOrigin(request("http://request.example", {
        host: "evil.example",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      })),
    ).toBe("http://request.example");
    vi.unstubAllEnvs();
  });

  it.each([
    { host: "request.example", proto: "https" },
    { host: "evil.example", proto: "https" },
    { host: "request.example", proto: "http" },
  ])("ignores forwarded origin values: %s", ({ host, proto }) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(
      getRequestOrigin(
        request("https://request.example", {
          host,
          "x-forwarded-host": host,
          "x-forwarded-proto": proto,
        }),
      ),
    ).toBe("https://request.example");
    vi.unstubAllEnvs();
  });
});

describe("proxy public paths", () => {
  it.each([
    "/manifest.webmanifest",
    "/sw.js",
    "/favicon.ico",
    "/icon-192.png",
    "/icon-512.png",
    "/_next/static/chunk.js",
    "/_next/image?url=%2Ficon-192.png",
  ])("allows required public path %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(["/login", "/signup", "/auth/callback"])(
    "allows public auth path %s",
    (path) => {
      expect(isPublicAuthPath(path)).toBe(true);
    },
  );

  it.each(["/auth/callback-extra", "/auth/callback-debug", "/auth/callback/foo", "/api/test", "/admin", "/debug"])(
    "does not make protected path public: %s",
    (path) => {
      expect(isPublicAuthPath(path)).toBe(false);
      expect(isPublicPath(path)).toBe(false);
    },
  );

  it.each(["/data.json", "/arbitrary.js", "/styles.css", "/source.map"])(
    "does not broadly allow arbitrary extension path %s",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});

describe("service worker authenticated navigation boundary", () => {
  it("does not precache or fallback to authenticated pages", () => {
    expect(serviceWorkerSource).not.toMatch(/OFFLINE_URLS\s*=\s*[^;]*["']\/["']/);
    expect(serviceWorkerSource).not.toContain('caches.match("/")');
    expect(serviceWorkerSource).toContain('event.request.mode === "navigate"');
  });
});
