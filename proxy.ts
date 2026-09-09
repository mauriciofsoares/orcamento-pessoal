import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_FILE = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|json|webmanifest|js|css|map)$/i;

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png" ||
    PUBLIC_FILE.test(pathname)
  );
}

function isPublicAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth/callback")
  );
}

function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (aBytes[index] ?? 0) ^ (bBytes[index] ?? 0);
  }

  return diff === 0;
}

function getBasicPassword(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return null;

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;

    return decoded.slice(separatorIndex + 1);
  } catch {
    return null;
  }
}

function htmlResponse(body: string, status: number, headers?: HeadersInit) {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

function passwordRequiredResponse() {
  return htmlResponse(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Senha obrigat\u00f3ria</title>
    <style>
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #020617; color: #e2e8f0; font-family: system-ui, sans-serif; }
      main { width: min(92vw, 420px); border: 1px solid #1e293b; border-radius: 16px; padding: 28px; background: #0f172a; box-shadow: 0 24px 80px rgba(0, 0, 0, .35); }
      h1 { margin: 0 0 8px; font-size: 1.25rem; }
      p { margin: 0; color: #94a3b8; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <h1>Senha obrigat\u00f3ria</h1>
      <p>Informe a senha do app para acessar seus dados financeiros.</p>
    </main>
  </body>
</html>`,
    401,
    { "WWW-Authenticate": 'Basic realm="Orcamento Pessoal", charset="UTF-8"' },
  );
}

function appPasswordMissingResponse() {
  return htmlResponse(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>APP_PASSWORD n\u00e3o configurada</title>
    <style>
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #020617; color: #e2e8f0; font-family: system-ui, sans-serif; }
      main { width: min(92vw, 460px); border: 1px solid #7f1d1d; border-radius: 16px; padding: 28px; background: #0f172a; box-shadow: 0 24px 80px rgba(0, 0, 0, .35); }
      h1 { margin: 0 0 8px; font-size: 1.25rem; }
      p { margin: 0; color: #fecaca; line-height: 1.5; }
      code { color: #fda4af; }
    </style>
  </head>
  <body>
    <main>
      <h1>Prote\u00e7\u00e3o n\u00e3o configurada</h1>
      <p>Configure <code>APP_PASSWORD</code> nas vari\u00e1veis de ambiente antes de publicar o app.</p>
    </main>
  </body>
</html>`,
    503,
  );
}

export function proxy(request: NextRequest) {
  if (
    isPublicPath(request.nextUrl.pathname) ||
    isPublicAuthPath(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return appPasswordMissingResponse();
  }

  const providedPassword = getBasicPassword(request);
  if (!providedPassword || !timingSafeEqual(providedPassword, appPassword)) {
    return passwordRequiredResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-192.png|icon-512.png).*)"],
};