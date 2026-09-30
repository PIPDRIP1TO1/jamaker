import { acceptInvitationAction } from "@/app/actions/team";
import { requireSession } from "@/lib/auth/session";
import Link from "next/link";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await requireSession();
  return (
    <main className="landing-shell">
      <section className="billing-card">
        <span className="pill">Invitation équipe</span>
        <h2>Rejoindre l&apos;organisation ?</h2>
        <p>Connecté en tant que {session.user.email}. Le lien est lié à l&apos;e-mail invité.</p>
        <form action={acceptInvitationAction.bind(null, token)}>
          <button className="button" type="submit">Accepter et rejoindre</button>
        </form>
        <Link href="/dashboard" className="text-link">Retour dashboard</Link>
      </section>
    </main>
  );
}
