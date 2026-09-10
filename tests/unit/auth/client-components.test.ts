import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Estes componentes sao "use client" (hooks + DOM). O projeto nao possui jsdom
// nem @testing-library/react configurados, e esta etapa e' proibida de instalar
// dependencias novas ou criar infraestrutura de teste. Por isso, validamos o
// CONTRATO DE COMPORTAMENTO via leitura do codigo-fonte (mesma tecnica ja usada
// em tests/unit/security-boundaries.test.ts para public/sw.js), em vez de
// renderizacao real. Isso ainda protege contra regressao: se alguem remover a
// chamada de signOut/replace/refresh, o teste quebra.
const loginFormSource = readFileSync("app/login/LoginForm.tsx", "utf8");
const loginPageSource = readFileSync("app/login/page.tsx", "utf8");
const signupPageSource = readFileSync("app/signup/page.tsx", "utf8");
const signupFormSource = readFileSync("app/signup/SignUpForm.tsx", "utf8");
const recoverPasswordFormSource = readFileSync(
  "app/recuperar-senha/RecoverPasswordForm.tsx",
  "utf8",
);
const newPasswordFormSource = readFileSync("app/nova-senha/NewPasswordForm.tsx", "utf8");
const logoutButtonSource = readFileSync("components/LogoutButton.tsx", "utf8");

describe("LoginForm - contrato de comportamento (login email/senha)", () => {
  it("autentica via supabase.auth.signInWithPassword", () => {
    expect(loginFormSource).toContain("supabase.auth.signInWithPassword");
  });

  it("le o parametro next da URL e valida com safeNextPath antes de usar (nunca confia cegamente)", () => {
    expect(loginFormSource).toContain("useSearchParams");
    expect(loginFormSource).toContain('safeNextPath(searchParams.get("next"))');
  });

  it("redireciona para o destino validado (next ou '/') e atualiza o router apos sucesso", () => {
    expect(loginFormSource).toContain("router.replace(destination)");
    expect(loginFormSource).toContain("router.refresh()");
  });

  it("exibe mensagem genérica de erro de credenciais, sem revelar se o e-mail existe (design Figma)", () => {
    expect(loginFormSource).toContain('setError("E-mail ou senha incorretos.")');
    expect(loginFormSource).not.toContain("setError(signInError.message)");
  });
});

describe("LoginForm - contrato de comportamento (Google OAuth)", () => {
  it("usa signInWithOAuth com provider google", () => {
    expect(loginFormSource).toContain('provider: "google"');
    expect(loginFormSource).toContain("signInWithOAuth");
  });

  it("constroi o redirectTo via buildAuthCallbackUrl (origem atual + next validado), nunca uma URL externa", () => {
    expect(loginFormSource).toContain(
      'redirectTo: buildAuthCallbackUrl(window.location.origin, searchParams.get("next"))',
    );
  });
});

describe("Login page (Server Component) - redireciona sessao ja autenticada", () => {
  it("verifica supabase.auth.getUser() e redireciona para '/' quando ja ha sessao", () => {
    expect(loginPageSource).toContain("supabase.auth.getUser()");
    expect(loginPageSource).toContain('redirect("/")');
  });
});

describe("Signup page (Server Component) - redireciona sessao ja autenticada (BUG/UX corrigido)", () => {
  it("verifica supabase.auth.getUser() e redireciona para '/' quando ja ha sessao, igual a /login", () => {
    expect(signupPageSource).toContain("supabase.auth.getUser()");
    expect(signupPageSource).toContain('redirect("/")');
  });

  it("renderiza o formulario de cadastro para o usuario anonimo", () => {
    expect(signupPageSource).toContain("<SignUpForm />");
  });
});

describe("SignUpForm - contrato de comportamento (next preservado, igual a LoginForm)", () => {
  it("continua acessivel para usuario anonimo e usa supabase.auth.signUp", () => {
    expect(signupFormSource).toContain("supabase.auth.signUp");
  });

  it("le o parametro next da URL e valida com safeNextPath antes de usar (nunca confia cegamente)", () => {
    expect(signupFormSource).toContain("useSearchParams");
    expect(signupFormSource).toContain('safeNextPath(searchParams.get("next"))');
  });

  it("redireciona para o destino validado (next ou '/') quando o cadastro ja cria sessao", () => {
    expect(signupFormSource).toContain("router.replace(destination)");
    expect(signupFormSource).toContain("router.refresh()");
  });

  it("constroi o emailRedirectTo via buildAuthCallbackUrl (origem atual + next validado)", () => {
    expect(signupFormSource).toContain(
      'emailRedirectTo: buildAuthCallbackUrl(window.location.origin, searchParams.get("next"))',
    );
  });
});

describe("Recuperação de senha - contrato de comportamento", () => {
  it("envia o link por resetPasswordForEmail com callback seguro para /nova-senha", () => {
    expect(recoverPasswordFormSource).toContain("supabase.auth.resetPasswordForEmail");
    expect(recoverPasswordFormSource).toContain(
      'buildAuthCallbackUrl(window.location.origin, "/nova-senha")',
    );
  });

  it("atualiza a senha via Supabase e confirma o sucesso antes de redirecionar", () => {
    expect(newPasswordFormSource).toContain("supabase.auth.updateUser({ password })");
    expect(newPasswordFormSource).toContain('toast.success("Senha atualizada com sucesso.")');
    expect(newPasswordFormSource).toContain('router.replace("/")');
  });
});

describe("LogoutButton - contrato de comportamento", () => {
  it("chama supabase.auth.signOut()", () => {
    expect(logoutButtonSource).toContain("supabase.auth.signOut()");
  });

  it("redireciona para /login e atualiza o router apos o logout", () => {
    expect(logoutButtonSource).toContain('router.replace("/login")');
    expect(logoutButtonSource).toContain("router.refresh()");
  });

  it("trata erro de signOut exibindo mensagem, sem deixar a sessao em estado indefinido silenciosamente", () => {
    expect(logoutButtonSource).toContain("signOutError.message");
  });
});
