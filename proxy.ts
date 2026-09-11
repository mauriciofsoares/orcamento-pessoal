import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "@/lib/safe-next-path";

export function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/login-assets/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/icon.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png"
  );
}

export function isPublicAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/recuperar-senha" ||
    pathname === "/nova-senha" ||
    pathname === "/auth/callback"
  );
}

async function hasSupabaseUser(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return false;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    });

    const { data } = await supabase.auth.getClaims();
    return Boolean(data?.claims?.sub);
  } catch {
    return false;
  }
}

// Preserva a rota originalmente pedida em ?next=, para o login poder voltar para la depois.
function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const requestedPath = safeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);

  if (requestedPath !== "/") {
    loginUrl.searchParams.set("next", requestedPath);
  }

  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  if (
    isPublicPath(request.nextUrl.pathname) ||
    isPublicAuthPath(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  if (await hasSupabaseUser(request, response)) return response;

  return redirectToLogin(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon-192.png|icon-512.png).*)"],
};