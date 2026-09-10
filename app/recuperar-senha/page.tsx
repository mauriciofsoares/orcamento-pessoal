import { Suspense } from "react";
import { RecoverPasswordForm } from "@/app/recuperar-senha/RecoverPasswordForm";

export default function RecoverPasswordPage() {
  return (
    <Suspense>
      <RecoverPasswordForm />
    </Suspense>
  );
}