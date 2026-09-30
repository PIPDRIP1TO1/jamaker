import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentSession } from "@/lib/auth/session";

export default async function RegisterPage() {
  if (await getCurrentSession()) redirect("/dashboard");
  return <AuthShell title="Créez votre espace JA MAKER" lead="Un compte propriétaire et une organisation privée seront créés ensemble."><AuthForm mode="register" /></AuthShell>;
}
