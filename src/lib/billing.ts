import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { plans } from "@/config/plans";

export type SubscriptionStatus = "incomplete" | "trial" | "active" | "past_due" | "paused" | "cancelled";

type SubscriptionRow = {
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: number;
};

export async function getBillingOverview(organizationId: string) {
  const db = await getDb();
  const result = await db.query<SubscriptionRow>(
    `SELECT status, current_period_end, cancel_at_period_end
     FROM subscriptions
     WHERE organization_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId],
  );
  const subscription = result.rows[0];
  const status = subscription?.status || "trial";

  return {
    plan: plans.creator,
    status,
    currentPeriodEnd: subscription?.current_period_end || null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    canRunAutomations: status === "active" || status === "trial",
  };
}

export async function requireAutomationEntitlement() {
  const session = await requireSession();
  const billing = await getBillingOverview(session.organization.id);
  if (!billing.canRunAutomations) redirect("/dashboard/billing?required=active");
  return { session, billing };
}

export const billingStatusLabels: Record<SubscriptionStatus, string> = {
  incomplete: "Paiement requis",
  trial: "Accès de développement",
  active: "Abonnement actif",
  past_due: "Paiement en retard",
  paused: "Automations suspendues",
  cancelled: "Abonnement résilié",
};
