"use client";

import { useActionState } from "react";
import { inviteMemberAction, type TeamState } from "@/app/actions/team";

const initialState: TeamState = {};

export function TeamInviteForm({ canInviteAdmin }: { canInviteAdmin: boolean }) {
  const [state, action, pending] = useActionState(inviteMemberAction, initialState);
  return (
    <div>
      <form action={action} className="coupon-row">
        <input type="email" name="email" placeholder="membre@exemple.com" required />
        <select name="role" defaultValue="member" aria-label="Rôle invité">
          <option value="member">member</option>
          {canInviteAdmin && <option value="admin">admin</option>}
        </select>
        <button className="button button-small" type="submit" disabled={pending}>{pending ? "Création…" : "Créer invitation"}</button>
      </form>
      {state.message && <p className="billing-note" role="status">{state.message}</p>}
      {state.inviteLink && <p className="billing-note"><strong>Lien :</strong> {state.inviteLink}</p>}
    </div>
  );
}
