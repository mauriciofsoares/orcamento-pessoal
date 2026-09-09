import { LoginForm } from "@/app/login/LoginForm";

function loginErrorMessage(error: string | string[] | undefined) {
  const value = Array.isArray(error) ? error[0] : error;

  return value === "auth_callback"
    ? "Não foi possível concluir o login. Tente novamente."
    : null;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;

  return <LoginForm initialError={loginErrorMessage(params.error)} />;
}