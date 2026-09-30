import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentSession } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return <AuthShell title="Connectez-vous à votre espace" lead="Retrouvez vos projets, connexions et automations."><AuthForm mode="login" /></AuthShell>;
}
