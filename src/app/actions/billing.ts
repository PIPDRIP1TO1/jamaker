"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { plans, formatUsd } from "@/config/plans";
import { createCheckoutSession } from "@/lib/payments";

export type CouponState = {
  status?: "valid" | "invalid";
  message?: string;
  code?: string;
  finalPrice?: string;
};

type CouponRow = {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  currency: string | null;
};

export async function validateCouponAction(_state: CouponState, formData: FormData): Promise<CouponState> {
  await requireSession();
  const code = String(formData.get("coupon") || "").trim().toUpperCase();
  if (!code || code.length < 3 || code.length > 40) {
    return { status: "invalid", message: "Saisissez un code promo valide." };
  }

  const db = await getDb();
  const result = await db.query<CouponRow>(
    `SELECT code, discount_type, discount_value, currency
     FROM coupons
     WHERE UPPER(code) = $1
       AND active = 1
       AND (starts_at IS NULL OR datetime(starts_at) <= datetime('now'))
       AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
       AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
     LIMIT 1`,
    [code],
  );
  const coupon = result.rows[0];
  if (!coupon || (coupon.discount_type === "fixed" && coupon.currency && coupon.currency !== plans.creator.currency)) {
    return { status: "invalid", message: "Ce code est invalide ou expiré." };
  }

  const discount = coupon.discount_type === "percent"
    ? Math.floor(plans.creator.priceCents * Math.min(coupon.discount_value, 100) / 100)
    : Math.min(coupon.discount_value, plans.creator.priceCents);
  const finalCents = Math.max(0, plans.creator.priceCents - discount);

  return {
    status: "valid",
    code: coupon.code.toUpperCase(),
    finalPrice: formatUsd(finalCents / 100),
    message: `Code valide. Prix après réduction : ${formatUsd(finalCents / 100)} / mois.`,
  };
}

export type CheckoutState = { message?: string };

export async function createCheckoutAction(_state: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const session = await requireSession();
  const coupon = String(formData.get("coupon") || "").trim() || null;
  const result = await createCheckoutSession(session.organization.id, session.user.id, coupon);
  revalidatePath("/dashboard/billing");
  return { message: result.message };
}
