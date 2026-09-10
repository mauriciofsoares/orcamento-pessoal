"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2, Sparkles, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl, safeNextPath } from "@/lib/safe-next-path";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600";
const labelClass = "mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400";

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir o cadastro.";
}

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Nunca confiar cegamente no valor da URL: sempre passar por safeNextPath antes de usar.
  const destination = safeNextPath(searchParams.get("next"));

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Informe um e-mail válido.");
      return;
    }

    if (!password) {
      setError("Informe uma senha.");
      return;
    }

    if (password !== confirmPassword) {
      setError("A confirmação de senha precisa ser igual à senha.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      // O destino ja validado (safeNextPath) viaja no emailRedirectTo do proprio site;
      // o Supabase apenas anexa "code" a essa URL, sem introduzir redirect externo.
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: buildAuthCallbackUrl(window.location.origin, searchParams.get("next")),
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.replace(destination);
        router.refresh();
        return;
      }

      setMessage("Cadastro criado. Confira seu e-mail para confirmar a conta antes de entrar.");
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
            Crie sua conta
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Prepare seu orçamento para uma experiência individual.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSignUp}>
          <div>
            <label className={labelClass} htmlFor="name">
              Nome
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              className={fieldClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className={fieldClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@email.com"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              className={fieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Crie uma senha"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="confirm-password">
              Confirmar senha
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              className={fieldClass}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a senha"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="size-4" aria-hidden />
            )}
            Cadastrar
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
          Já possui uma conta?{" "}
          <Link className="font-medium text-emerald-500 hover:text-emerald-400" href="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
