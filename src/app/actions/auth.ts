"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";

export type AuthState = {
  message?: string;
  errors?: Partial<Record<"name" | "workspace" | "email" | "password", string>>;
};

type UserRow = { id: string; password_hash: string; organization_id: string };

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "workspace";
}

function validatePassword(password: string) {
  return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export async function registerAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") || "").trim();
  const workspace = String(formData.get("workspace") || "").trim();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  const errors: AuthState["errors"] = {};

  if (name.length < 2) errors.name = "Indiquez votre nom.";
  if (workspace.length < 2) errors.workspace = "Indiquez le nom de votre espace.";
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Adresse e-mail invalide.";
  if (!validatePassword(password)) errors.password = "10 caractères minimum, avec une lettre et un chiffre.";
  if (Object.keys(errors).length) return { errors };

  const db = await getDb();
  const existing = await db.query<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1", [email]);
  if (existing.rows.length) return { errors: { email: "Un compte existe déjà avec cet e-mail." } };

  const userId = randomUUID();
  const organizationId = randomUUID();
  const passwordHash = await hashPassword(password);
  const uniqueSlug = `${slugify(workspace)}-${organizationId.slice(0, 8)}`;

  await db.transaction(async (tx) => {
    await tx.query("INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)", [userId, name, email, passwordHash]);
    await tx.query("INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)", [organizationId, workspace, uniqueSlug]);
    await tx.query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')", [organizationId, userId]);
  });

  await createSession(userId, organizationId);
  redirect("/dashboard");
}

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");
  if (!email || !password) return { message: "Saisissez votre e-mail et votre mot de passe." };

  const db = await getDb();
  const result = await db.query<UserRow>(
    `SELECT u.id, u.password_hash, om.organization_id
     FROM users u
     JOIN organization_members om ON om.user_id = u.id
     WHERE LOWER(u.email) = $1
     ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
     LIMIT 1`,
    [email],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { message: "E-mail ou mot de passe incorrect." };
  }

  await createSession(user.id, user.organization_id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
