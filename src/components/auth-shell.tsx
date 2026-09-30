import Link from "next/link";

export function AuthShell({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link href="/" className="brand"><span className="brand-mark">JA</span><span>MAKER</span></Link>
        <div><p className="eyebrow">Votre atelier SaaS</p><h1>Créez.<br />Automatisez.<br /><span>Gardez le contrôle.</span></h1><p>Vos comptes restent les vôtres. Vos données sont séparées dans un espace privé.</p></div>
        <small>JA MAKER • $20 USD / mois avant coupon</small>
      </section>
      <section className="auth-content">
        <div className="auth-card"><p className="eyebrow">Bienvenue</p><h2>{title}</h2><p className="auth-lead">{lead}</p>{children}</div>
      </section>
    </main>
  );
}
