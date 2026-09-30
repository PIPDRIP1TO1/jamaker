"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { isMessageKind, type MessageKind } from "@/lib/messages";
import { logAudit } from "@/lib/audit";

export type BoardState = { message?: string };

async function saveMessage(kind: MessageKind, moduleSlug: string, title: string, body: string, url: string, revalidate: string): Promise<BoardState> {
  const session = await requireSession();
  const cleanTitle = title.trim().slice(0, 120);
  if (cleanTitle.length < 3) return { message: "Titre trop court." };
  const db = await getDb();
  const id = randomUUID();
  await db.query(
    `INSERT INTO workspace_messages (id, organization_id, kind, module_slug, title, body, url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, session.organization.id, kind, moduleSlug.slice(0, 60), cleanTitle, body.trim().slice(0, 4000), url.trim().slice(0, 500)],
  );
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: `board.${kind}.create`, entityType: moduleSlug || kind, entityId: id });
  revalidatePath(revalidate);
  return { message: "Enregistré." };
}

export async function createSignalAction(_state: BoardState, formData: FormData): Promise<BoardState> {
  const kind = String(formData.get("kind") || "signal");
  if (!isMessageKind(kind)) return { message: "Type invalide." };
  const moduleSlug = String(formData.get("moduleSlug") || "");
  return saveMessage(
    kind,
    moduleSlug,
    String(formData.get("title") || ""),
    String(formData.get("body") || ""),
    String(formData.get("url") || ""),
    moduleSlug ? `/dashboard/tools/${moduleSlug}` : "/dashboard/modules",
  );
}

export async function deleteMessageAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") || "");
  const moduleSlug = String(formData.get("moduleSlug") || "");
  if (!id) return;
  const db = await getDb();
  await db.query("DELETE FROM workspace_messages WHERE id = $1 AND organization_id = $2", [id, session.organization.id]);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "board.delete", entityType: "message", entityId: id });
  revalidatePath(moduleSlug ? `/dashboard/tools/${moduleSlug}` : "/dashboard/modules");
}
