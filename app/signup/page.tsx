import { redirect } from "next/navigation";
import { SignUpForm } from "@/app/signup/SignUpForm";
import { createClient } from "@/lib/supabase/server";

export default async function SignUpPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/");
  }

  return <SignUpForm />;
}