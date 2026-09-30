"use client";

import { useActionState } from "react";
import { validateCouponAction, type CouponState } from "@/app/actions/billing";

const initialState: CouponState = {};

export function CouponForm() {
  const [state, action, pending] = useActionState(validateCouponAction, initialState);

  return (
    <div className="coupon-box">
      <div>
        <label htmlFor="coupon">Code promo</label>
        <p>Le montant final est toujours recalculé côté serveur au moment du paiement.</p>
      </div>
      <form action={action} className="coupon-controls">
        <input id="coupon" name="coupon" placeholder="Votre code" autoComplete="off" maxLength={40} required />
        <button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Vérification…" : "Appliquer"}</button>
      </form>
      {state.message && <p className={`coupon-result coupon-${state.status}`} role="status">{state.message}</p>}
    </div>
  );
}
