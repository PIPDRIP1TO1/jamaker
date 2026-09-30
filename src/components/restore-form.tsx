"use client";

import { useActionState } from "react";
import { restoreBackupAction, type RestoreState } from "@/app/actions/backups";

const initialState: RestoreState = {};

export function RestoreForm() {
  const [state, action, pending] = useActionState(restoreBackupAction, initialState);
  return (
    <div>
      <form action={action} className="coupon-controls">
        <input type="file" name="backup" accept="application/json,.json" required aria-label="Fichier JSON d'export" />
        <button className="button" type="submit" disabled={pending}>{pending ? "Restauration…" : "Restaurer les projets"}</button>
      </form>
      {state.message && <p className="billing-note" role="status">{state.message}</p>}
    </div>
  );
}
