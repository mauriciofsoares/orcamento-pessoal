"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const MINIMUM_PASSWORD_LENGTH = 8;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível atualizar a senha. Tente novamente.";
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  isVisible,
  onToggleVisibility,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 text-left">
      <label className="text-sm font-semibold text-[#94A3B8]" htmlFor={id}>{label}</label>
      <div className="flex h-12 items-center gap-3 rounded-lg border border-[#334155] bg-[#020617] px-4 transition-colors focus-within:border-[#10B981] has-[input:disabled]:opacity-50">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          autoComplete="new-password"
          required
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#F8FAFC] outline-none placeholder:text-[#64748B]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          disabled={disabled}
          aria-label={isVisible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          className="shrink-0 text-[#64748B] transition-colors hover:text-[#94A3B8] disabled:opacity-50"
        >
          {isVisible ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export function NewPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setError(`A senha deve ter pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(getErrorMessage(updateError));
        return;
      }

      toast.success("Senha atualizada com sucesso.");
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#08101F] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-[700px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-[-20%]">
          <img alt="" className="block size-full max-w-none" src="/login-assets/ambient-glow.svg" />
        </div>
      </div>

      <section className="relative w-full max-w-[520px] rounded-[24px] border border-[#334155] bg-[#172033] p-10 text-center shadow-[0_16px_48px_0_rgba(0,0,0,0.25)] [@media(max-height:850px)]:p-6">
        <div className="mb-6 flex flex-col items-center gap-3 [@media(max-height:850px)]:mb-4 [@media(max-height:850px)]:gap-2">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#10B981] [@media(max-height:850px)]:size-14">
            <img alt="" className="block h-[38px] w-[38px] max-w-none" src="/login-assets/growth-chart.svg" />
          </div>
          <p className="font-outfit text-2xl font-bold text-[#F8FAFC] [@media(max-height:850px)]:text-xl">Saldo Seguro</p>
          <p className="text-xs font-medium text-[#10B981]">FINANÇAS PESSOAIS</p>
        </div>

        <div className="mb-6 flex flex-col gap-3 [@media(max-height:850px)]:mb-4 [@media(max-height:850px)]:gap-2">
          <h1 className="font-outfit text-[28px] font-semibold text-[#F8FAFC] [@media(max-height:850px)]:text-2xl">Criar nova senha</h1>
          <p className="text-base leading-6 text-[#94A3B8] [@media(max-height:850px)]:text-sm">Digite sua nova senha de acesso abaixo.</p>
        </div>

        <form className="flex flex-col gap-5 [@media(max-height:850px)]:gap-4" onSubmit={handleSubmit} noValidate>
          <PasswordField id="password" label="Nova senha" placeholder="Sua nova senha" value={password} onChange={setPassword} isVisible={isPasswordVisible} onToggleVisibility={() => setIsPasswordVisible((visible) => !visible)} disabled={isLoading} />
          <PasswordField id="confirmation" label="Confirmar nova senha" placeholder="Repita a senha" value={confirmation} onChange={setConfirmation} isVisible={isConfirmationVisible} onToggleVisibility={() => setIsConfirmationVisible((visible) => !visible)} disabled={isLoading} />
          <div aria-live="polite">{error && <p className="text-left text-xs text-[#F87171]">{error}</p>}</div>
          <button type="submit" disabled={isLoading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#10B981] text-sm font-bold text-[#020617] transition-colors hover:bg-[#34D399] active:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50">
            {isLoading ? <><Loader2 className="size-4 animate-spin" aria-hidden />Atualizando...</> : "Atualizar senha"}
          </button>
        </form>
      </section>
    </main>
  );
}