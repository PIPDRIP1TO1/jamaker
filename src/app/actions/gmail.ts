"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createGmailDraft } from "@/lib/gmail";
import { logAudit } from "@/lib/audit";

export type GmailState = { message?: string };

export async function createGmailDraftAction(_state: GmailState, formData: FormData): Promise<GmailState> {
  const session = await requireSession();
  const result = await createGmailDraft(
    session.organization.id,
    String(formData.get("to") || ""),
    String(formData.get("subject") || ""),
    String(formData.get("body") || ""),
  );
  if (!result.ok) return { message: result.message };
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "gmail.draft", entityType: "draft", entityId: result.draftId });
  revalidatePath("/dashboard/tools/mailboxes");
  return { message: "Brouillon créé dans Gmail (rien n'est envoyé)." };
}
