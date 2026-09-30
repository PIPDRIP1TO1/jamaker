import { DashboardShell } from "@/components/dashboard-shell";
import { formatUsd, plans } from "@/config/plans";
import { CouponForm } from "@/components/coupon-form";
import { CheckoutForm } from "@/components/checkout-form";
import { requireSession } from "@/lib/auth/session";
import { billingStatusLabels, getBillingOverview } from "@/lib/billing";

export default async function BillingPage() {
  const session = await requireSession();
  const billing = await getBillingOverview(session.organization.id);
  const plan = plans.creator;

  return (
    <DashboardShell eyebrow="Facturation JA MAKER" title="Abonnement">
      <section className="billing-card">
        <div><span className="pill">{plan.name}</span><h2>Un tarif simple, sans surprise.</h2><p>L&apos;abonnement JA MAKER finance l&apos;accès à la plateforme. Vos comptes et éventuels frais externes restent séparés.</p><span className={`billing-status billing-${billing.status}`}>{billingStatusLabels[billing.status]}</span></div>
        <div className="price"><strong>{formatUsd(plan.priceUsd)}</strong><span>USD / mois</span></div>
        <ul><li>✓ Espace client privé</li><li>✓ Connexions personnelles</li><li>✓ Automations modulaires</li><li>✓ Données exportables</li></ul>
        <CouponForm />
        <CheckoutForm />
      </section>
      <p className="billing-note">Le tarif public est fixé à {formatUsd(plan.priceUsd)} USD par mois avant coupon. À l&apos;expiration d&apos;un abonnement, les automations seront mises en pause. L&apos;utilisateur conservera un accès en lecture et pourra exporter ses données.</p>
    </DashboardShell>
  );
}
