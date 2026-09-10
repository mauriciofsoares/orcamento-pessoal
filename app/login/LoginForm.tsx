"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl, safeNextPath } from "@/lib/safe-next-path";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a autenticação.";
}

export function LoginForm({ initialError = null }: { initialError?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isBusy = isLoading || isGoogleLoading;

  // Nunca confiar cegamente no valor da URL: sempre passar por safeNextPath antes de usar.
  const destination = safeNextPath(searchParams.get("next"));

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Validação leve de formato antes de gastar uma chamada de rede, sem expor
    // se o e-mail existe ou não (isso é responsabilidade exclusiva do Supabase).
    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("E-mail inválido");
      return;
    }
    setEmailError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Mensagem genérica: nunca revelar se o e-mail existe ou se foi a senha que errou.
        setError("E-mail ou senha incorretos.");
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const supabase = createClient();
      // O destino ja validado (safeNextPath) viaja no redirectTo do proprio site;
      // o Supabase apenas anexa "code" a essa URL, sem introduzir redirect externo.
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildAuthCallbackUrl(window.location.origin, searchParams.get("next")),
        },
      });

      if (oauthError) {
        setIsGoogleLoading(false);
        setError(oauthError.message);
      }
    } catch (error) {
      setIsGoogleLoading(false);
      setError(getErrorMessage(error));
    }
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#08101F] px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[700px] -translate-x-1/2 -translate-y-1/2"
      >
        <div className="absolute inset-[-20%]">
          <img alt="" className="block size-full max-w-none" src="/login-assets/ambient-glow.svg" />
        </div>
      </div>

      <section className="relative w-full max-w-[520px] rounded-[24px] border border-[#334155] bg-[#172033] p-10 shadow-[0_16px_48px_0_rgba(0,0,0,0.25)] [@media(max-height:850px)]:p-6">
        <div className="mb-6 flex flex-col items-center gap-3 text-center [@media(max-height:850px)]:mb-4 [@media(max-height:850px)]:gap-2">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#10B981] [@media(max-height:850px)]:size-14">
            <img
              alt=""
              className="block size-full rounded-2xl"
              src="/icon-192.png"
            />
          </div>
          <p className="font-outfit text-2xl font-bold text-[#F8FAFC] [@media(max-height:850px)]:text-xl">Saldo Seguro</p>
          <p className="text-xs font-medium text-[#10B981]">FINANÇAS PESSOAIS</p>
        </div>

        <div className="mb-6 flex flex-col items-center gap-3 text-center [@media(max-height:850px)]:mb-4 [@media(max-height:850px)]:gap-2">
          <h1 className="font-outfit text-[28px] font-semibold text-[#F8FAFC] [@media(max-height:850px)]:text-2xl">
            Entre na sua conta
          </h1>
          <p className="text-base text-[#94A3B8] [@media(max-height:850px)]:text-sm">Tenha clareza sobre o seu dinheiro.</p>
        </div>

        <form className="flex flex-col gap-5 [@media(max-height:850px)]:gap-4" onSubmit={handleEmailLogin} noValidate>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[#94A3B8]" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={isBusy}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "email-error" : undefined}
              className="h-12 w-full rounded-lg border bg-[#020617] px-4 text-sm text-[#F8FAFC] outline-none transition-colors placeholder:text-[#64748B] disabled:opacity-50 border-[#334155] focus:border-[#10B981] aria-invalid:border-[#F87171]"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="voce@email.com"
            />
            {emailError && (
              <p id="email-error" className="text-xs text-[#F87171]">
                {emailError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#94A3B8]" htmlFor="password">
                Senha
              </label>
              <Link
                className="text-[13px] font-semibold text-[#10B981] hover:underline"
                href="/login"
              >
                Esqueci minha senha
              </Link>
            </div>
            <div className="flex h-12 w-full items-center gap-3 rounded-lg border border-[#334155] bg-[#020617] px-4 transition-colors focus-within:border-[#10B981] has-[input:disabled]:opacity-50">
              <input
                id="password"
                type={isPasswordVisible ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={isBusy}
                className="min-w-0 flex-1 bg-transparent text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B]"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                disabled={isBusy}
                aria-label={isPasswordVisible ? "Ocultar senha" : "Mostrar senha"}
                className="shrink-0 text-[#64748B] transition-colors hover:text-[#94A3B8] disabled:opacity-50"
              >
                {isPasswordVisible ? (
                  <EyeOff className="size-[18px]" aria-hidden />
                ) : (
                  <Eye className="size-[18px]" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <div aria-live="polite">
            {error && (
              <p className="text-xs text-[#F87171]">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#10B981] text-sm font-bold text-[#020617] transition-colors hover:bg-[#34D399] active:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(255,255,255,0.25),0_0_0_2px_rgba(16,185,129,0.4)]"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <div className="my-4 flex items-center gap-4 [@media(max-height:850px)]:my-3">
          <div className="h-px flex-1 bg-[#334155]" />
          <span className="text-xs text-[#94A3B8]">ou</span>
          <div className="h-px flex-1 bg-[#334155]" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isBusy}
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-[#334155] bg-transparent text-sm font-semibold text-[#F8FAFC] transition-colors hover:border-[#475569] hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <Loader2 className="size-[18px] animate-spin" aria-hidden />
          ) : (
            <img alt="" className="size-[18px]" src="/login-assets/google-icon.png" />
          )}
          Continuar com Google
        </button>

        <p className="mt-5 text-center text-sm text-[#94A3B8] [@media(max-height:850px)]:mt-4">
          Não possui conta?{" "}
          <Link className="font-semibold text-[#10B981] hover:underline" href="/signup">
            Cadastre-se
          </Link>
        </p>
      </section>
    </main>
  );
}
