"use client";

import Link from "next/link";
import { CircleCheck, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl } from "@/lib/safe-next-path";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível enviar o link de recuperação. Tente novamente.";
}

function Brand() {
  return (
    <div className="mb-6 flex flex-col items-center gap-3 text-center [@media(max-height:850px)]:mb-4 [@media(max-height:850px)]:gap-2">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#10B981] [@media(max-height:850px)]:size-14">
        <img
          alt=""
          className="block h-[38px] w-[38px] max-w-none"
          src="/login-assets/growth-chart.svg"
        />
      </div>
      <p className="font-outfit text-2xl font-bold text-[#F8FAFC] [@media(max-height:850px)]:text-xl">
        Saldo Seguro
      </p>
      <p className="text-xs font-medium text-[#10B981]">FINANÇAS PESSOAIS</p>
    </div>
  );
}

export function RecoverPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setEmailError("E-mail inválido");
      return;
    }

    setEmailError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildAuthCallbackUrl(window.location.origin, "/nova-senha"),
      });

      if (resetError) {
        setError(getErrorMessage(resetError));
        return;
      }

      setIsSent(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
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

      <section className="relative w-full max-w-[520px] rounded-[24px] border border-[#334155] bg-[#172033] p-10 text-center shadow-[0_16px_48px_0_rgba(0,0,0,0.25)] [@media(max-height:850px)]:p-6">
        <Brand />

        {isSent ? (
          <div className="flex flex-col items-center gap-6">
            <div className="flex size-16 items-center justify-center rounded-full bg-[#10B981]">
              <CircleCheck className="size-7 text-[#020617]" aria-hidden />
            </div>
            <h1 className="font-outfit text-[28px] font-semibold text-[#F8FAFC] [@media(max-height:850px)]:text-2xl">
              E-mail enviado
            </h1>
            <p className="text-base leading-6 text-[#94A3B8] [@media(max-height:850px)]:text-sm">
              Se o seu e-mail estiver cadastrado, você receberá um link em instantes. Verifique também sua caixa de spam.
            </p>
            <Link
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-[#334155] text-sm font-semibold text-[#F8FAFC] transition-colors hover:border-[#475569] hover:bg-white/[0.03]"
              href="/login"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3 [@media(max-height:850px)]:mb-4 [@media(max-height:850px)]:gap-2">
              <h1 className="font-outfit text-[28px] font-semibold text-[#F8FAFC] [@media(max-height:850px)]:text-2xl">
                Recuperar senha
              </h1>
              <p className="text-base leading-6 text-[#94A3B8] [@media(max-height:850px)]:text-sm">
                Digite seu e-mail cadastrado para receber um link de redefinição.
              </p>
            </div>

            <form className="flex flex-col gap-5 text-left [@media(max-height:850px)]:gap-4" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-[#94A3B8]" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={emailError ? "email-error" : undefined}
                  className="h-12 w-full rounded-lg border border-[#334155] bg-[#020617] px-4 text-sm text-[#F8FAFC] outline-none transition-colors placeholder:text-[#64748B] focus:border-[#10B981] disabled:opacity-50 aria-invalid:border-[#F87171]"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="voce@email.com"
                />
                {emailError && <p id="email-error" className="text-xs text-[#F87171]">{emailError}</p>}
              </div>

              <div aria-live="polite">
                {error && <p className="text-xs text-[#F87171]">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#10B981] text-sm font-bold text-[#020617] transition-colors hover:bg-[#34D399] active:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? <><Loader2 className="size-4 animate-spin" aria-hidden />Enviando...</> : "Enviar link de recuperação"}
              </button>
            </form>

            <p className="mt-6 text-sm text-[#94A3B8] [@media(max-height:850px)]:mt-4">
              Lembrou a senha?{" "}
              <Link className="font-semibold text-[#10B981] hover:underline" href="/login">
                Voltar para o login
              </Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}