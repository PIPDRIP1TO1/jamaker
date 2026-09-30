"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { mintWorkerToken, revokeWorkerToken } from "@/lib/worker";

export type WorkerState = { message?: string; token?: string };

export async function createWorkerTokenAction(_state: WorkerState, formData: FormData): Promise<WorkerState> {
  const session = await requireSession();
  const name = String(formData.get("name") || "").trim().slice(0, 80) || "PC principal";
  const { token } = await mintWorkerToken(session.organization.id, name);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "worker.token.create", entityType: "worker", entityId: name });
  revalidatePath("/dashboard/automations");
  return { message: `Token créé pour « ${name} ». Copiez-le MAINTENANT, il ne s'affichera plus.`, token };
}

export async function revokeWorkerTokenAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await revokeWorkerToken(session.organization.id, id);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "worker.token.revoke", entityType: "worker", entityId: id });
  revalidatePath("/dashboard/automations");
}
