import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { applySubscriptionStatus } from "@/lib/payments";

type StripeLikeEvent = {
  id: string;
  type: string;
  data?: { object?: { customer?: string; subscription?: string; id?: string; metadata?: { organizationId?: string; organization_id?: string } } };
};

function mapStripeStatus(type: string): "active" | "past_due" | "paused" | "cancelled" | null {
  if (type.startsWith("customer.subscription.created") || type.startsWith("customer.subscription.updated")) return "active";
  if (type === "invoice.payment_succeeded") return "active";
  if (type === "invoice.payment_failed") return "past_due";
  if (type === "customer.subscription.paused") return "paused";
  if (type === "customer.subscription.deleted") return "cancelled";
  return null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  let event: StripeLikeEvent;
  try {
    event = JSON.parse(raw) as StripeLikeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event.id || !event.type) return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  // Vérification signature Stripe si configurée. Sans secret, on accepte uniquement les events dev préfixés.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("stripe-signature");
    if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    // Note : vérification HMAC complète à activer avec le SDK Stripe lors du branchement réel.
  } else if (!event.id.startsWith("dev_") && !event.type.startsWith("dev.")) {
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  }

  const status = event.type.startsWith("dev.")
    ? ((event.type.split(".")[1] as "active" | "past_due" | "paused" | "cancelled") || "active")
    : mapStripeStatus(event.type);
  if (!status) return NextResponse.json({ received: true, ignored: true });

  const obj = event.data?.object || {};
  const organizationId = obj.metadata?.organizationId || obj.metadata?.organization_id || null;
  if (!organizationId) return NextResponse.json({ error: "Missing organizationId" }, { status: 400 });

  const providerSubscriptionId = typeof obj.subscription === "string" ? obj.subscription : obj.id || null;
  const payloadHash = createHash("sha256").update(raw).digest("hex");
  const result = await applySubscriptionStatus({
    provider: webhookSecret ? "stripe" : "dev",
    providerEventId: event.id,
    eventType: event.type,
    organizationId,
    providerSubscriptionId,
    status,
    payloadHash,
  });
  return NextResponse.json({ received: true, deduped: result.deduped });
}
