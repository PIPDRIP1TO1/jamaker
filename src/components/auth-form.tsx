"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = {};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="auth-form">
      {isRegister && (
        <>
          <label>Votre nom<input name="name" autoComplete="name" placeholder="Nom complet" required /></label>
          {state.errors?.name && <p className="field-error">{state.errors.name}</p>}
          <label>Nom de l&apos;espace<input name="workspace" placeholder="Mon entreprise" required /></label>
          {state.errors?.workspace && <p className="field-error">{state.errors.workspace}</p>}
        </>
      )}
      <label>Adresse e-mail<input name="email" type="email" autoComplete="email" placeholder="vous@entreprise.com" required /></label>
      {state.errors?.email && <p className="field-error">{state.errors.email}</p>}
      <label>Mot de passe<input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "10 caractères minimum" : "Votre mot de passe"} required /></label>
      {state.errors?.password && <p className="field-error">{state.errors.password}</p>}
      {state.message && <p className="form-error">{state.message}</p>}
      <button className="button auth-submit" type="submit" disabled={pending}>{pending ? "Patientez…" : isRegister ? "Créer mon espace" : "Se connecter"}</button>
      <p className="auth-switch">{isRegister ? "Vous avez déjà un compte ?" : "Nouveau sur JA MAKER ?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Connexion" : "Créer un compte"}</Link></p>
    </form>
  );
}
