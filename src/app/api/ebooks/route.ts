import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { deleteEbookProject, listEbookProjects, saveEbookProject } from "@/lib/ebooks";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await requireSession();
  return NextResponse.json({ projects: await listEbookProjects(session.organization.id) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  try {
    const project = await saveEbookProject(session.organization.id, await request.json());
    await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "ebook.save", entityType: "ebook", entityId: project.id });
    return NextResponse.json({ success: true, project });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Sauvegarde impossible." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireSession();
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ success: false, error: "ID requis." }, { status: 400 });
  await deleteEbookProject(session.organization.id, id);
  await logAudit({ organizationId: session.organization.id, userId: session.user.id, action: "ebook.delete", entityType: "ebook", entityId: id });
  return NextResponse.json({ success: true });
}
