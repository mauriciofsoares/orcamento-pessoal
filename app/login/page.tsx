import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/LoginForm";
import { createClient } from "@/lib/supabase/server";

function loginErrorMessage(error: string | string[] | undefined) {
  const value = Array.isArray(error) ? error[0] : error;

  return value === "auth_callback"
    ? "Não foi possível concluir o login. Tente novamente."
    : null;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/");
  }

  return <LoginForm initialError={loginErrorMessage(params.error)} />;
}