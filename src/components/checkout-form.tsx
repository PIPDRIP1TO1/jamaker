"use client";

import { useActionState } from "react";
import { createCheckoutAction, type CheckoutState } from "@/app/actions/billing";

const initialState: CheckoutState = {};

export function CheckoutForm() {
  const [state, action, pending] = useActionState(createCheckoutAction, initialState);
  return (
    <div className="coupon-box">
      <form action={action} className="coupon-controls">
        <input name="coupon" placeholder="Coupon (optionnel)" autoComplete="off" maxLength={40} />
        <button className="button" type="submit" disabled={pending}>{pending ? "Création…" : "S'abonner — 20 USD / mois"}</button>
      </form>
      {state.message && <p className="billing-note" role="status">{state.message}</p>}
      {!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && (
        <p className="billing-note">Paiement réel désactivé : définissez STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET pour activer Stripe. En attendant, le checkout crée un abonnement dev traçable.</p>
      )}
    </div>
  );
}
