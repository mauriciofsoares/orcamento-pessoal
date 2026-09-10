// Aceita apenas caminhos internos; bloqueia protocolos externos, "//" e barras invertidas.
export function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  return value;
}

// Usado por LoginForm/SignUpForm para propagar o destino atraves do Google OAuth
// e da confirmacao por e-mail, que passam pelo /auth/callback. O proprio callback
// ja valida "next" de novo com safeNextPath antes de redirecionar.
export function buildAuthCallbackUrl(origin: string, next: string | null) {
  const destination = safeNextPath(next);
  const url = new URL("/auth/callback", origin);

  if (destination !== "/") {
    url.searchParams.set("next", destination);
  }

  return url.toString();
}
