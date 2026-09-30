import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { plans } from "@/config/plans";
import { logAudit } from "@/lib/audit";

export type CheckoutResult = { mode: "stripe" | "dev"; url: string | null; message: string };

function computeFinalCents(coupon: { discount_type: string; discount_value: number } | null) {
  if (!coupon) return { finalCents: plans.creator.priceCents, discountCents: 0 };
  const discount =
    coupon.discount_type === "percent"
      ? Math.floor(plans.creator.priceCents * Math.min(coupon.discount_value, 100) / 100)
      : Math.min(coupon.discount_value, plans.creator.priceCents);
  return { finalCents: Math.max(0, plans.creator.priceCents - discount), discountCents: discount };
}

export async function createCheckoutSession(organizationId: string, userId: string, couponCode: string | null): Promise<CheckoutResult> {
  const db = await getDb();
  let coupon: { id: string; code: string; discount_type: string; discount_value: number } | null = null;
  if (couponCode) {
    const code = couponCode.trim().toUpperCase();
    if (code.length >= 3) {
      const found = await db.query<{ id: string; code: string; discount_type: string; discount_value: number }>(
        `SELECT id, code, discount_type, discount_value FROM coupons WHERE UPPER(code) = $1 AND active = 1
         AND (starts_at IS NULL OR datetime(starts_at) <= datetime('now'))
         AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
         AND (max_redemptions IS NULL OR redemption_count < max_redemptions) LIMIT 1`,
        [code],
      );
      coupon = found.rows[0] || null;
    }
  }
  const { finalCents, discountCents } = computeFinalCents(coupon);
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    // Mode dev : crée un abonnement local "incomplete" + événement idempotent, en attendant Stripe réel.
    const subscriptionId = randomUUID();
    const eventId = `dev_checkout_${subscriptionId}`;
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO subscriptions (id, organization_id, plan_id, provider, status, price_cents, currency)
         VALUES ($1, $2, $3, 'dev', 'incomplete', $4, 'USD')`,
        [subscriptionId, organizationId, plans.creator.id, plans.creator.priceCents],
      );
      if (coupon) {
        await tx.query(
          `INSERT INTO coupon_redemptions (id, coupon_id, organization_id, subscription_id, amount_discounted_cents)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), coupon.id, organizationId, subscriptionId, discountCents],
        );
        await tx.query("UPDATE coupons SET redemption_count = redemption_count + 1 WHERE id = $1", [coupon.id]);
      }
      await tx.query(
        `INSERT INTO billing_events (id, provider, provider_event_id, event_type, organization_id, payload_hash)
         VALUES ($1, 'dev', $2, 'checkout.created', $3, $4)`,
        [randomUUID(), eventId, organizationId, createHash("sha256").update(subscriptionId).digest("hex")],
      );
    });
    await logAudit({ organizationId, userId, action: "billing.checkout.dev", entityType: "subscription", entityId: subscriptionId, metadata: { finalCents, coupon: coupon?.code || null } });
    return {
      mode: "dev",
      url: null,
      message: coupon
        ? `Mode dev : abonnement créé (${finalCents / 100} USD après ${coupon.code}). Branchez Stripe pour le paiement réel.`
        : "Mode dev : abonnement créé en statut incomplete. Branchez STRIPE_SECRET_KEY pour le checkout réel.",
    };
  }

  // Stripe réel : la création de session se fera ici (checkout.sessions.create).
  // On ne calcule jamais le prix côté navigateur : coupon validé ci-dessus, prix final recalculé au webhook.
  return { mode: "stripe", url: null, message: "Intégration Stripe détectée mais non câblée : ajoutez STRIPE price + webhook avant activation." };
}

export async function applySubscriptionStatus(input: {
  provider: string;
  providerEventId: string;
  eventType: string;
  organizationId: string | null;
  providerSubscriptionId: string | null;
  status: "incomplete" | "trial" | "active" | "past_due" | "paused" | "cancelled";
  payloadHash: string;
}) {
  const db = await getDb();
  const existing = await db.query<{ id: string }>("SELECT id FROM billing_events WHERE provider = $1 AND provider_event_id = $2 LIMIT 1", [input.provider, input.providerEventId]);
  if (existing.rows.length) return { deduped: true };
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO billing_events (id, provider, provider_event_id, event_type, organization_id, payload_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), input.provider, input.providerEventId, input.eventType, input.organizationId, input.payloadHash],
    );
    if (input.organizationId) {
      if (input.providerSubscriptionId) {
        await tx.query(
          `UPDATE subscriptions SET status = $1, provider_subscription_id = $2, updated_at = CURRENT_TIMESTAMP
           WHERE organization_id = $3 AND (provider_subscription_id = $2 OR provider_subscription_id IS NULL)`,
          [input.status, input.providerSubscriptionId, input.organizationId],
        );
      }
      const orgStatus = input.status === "active" || input.status === "trial" ? input.status : input.status === "incomplete" ? "trial" : input.status === "past_due" ? "past_due" : input.status === "paused" ? "paused" : "cancelled";
      await tx.query("UPDATE organizations SET subscription_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [orgStatus, input.organizationId]);
    }
  });
  if (input.organizationId) {
    await logAudit({ organizationId: input.organizationId, userId: null, action: `billing.webhook.${input.eventType}`, entityType: "subscription", entityId: input.providerSubscriptionId || "", metadata: { status: input.status } });
  }
  return { deduped: false };
}
