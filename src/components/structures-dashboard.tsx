import { deleteWorkspaceProfileAction } from "@/app/actions/structures";
import { StructureCreateForm, StructureEditForm } from "@/components/structure-forms";
import type { WorkspaceProfile } from "@/lib/workspace-profiles";

const labels: Record<string, string> = { browser: "Navigateur", social: "Réseau social", content: "Contenu", workspace: "Espace de travail" };
export function StructuresDashboard({ profiles }: { profiles: WorkspaceProfile[] }) {
  const plain = JSON.parse(JSON.stringify(profiles)) as WorkspaceProfile[];
  return <>
    <section className="structures-hero"><div><span className="pill">Organisation privée</span><h2>Structures et profils</h2><p>Organisez les profils de travail sans enregistrer leurs mots de passe, cookies ou chemins locaux.</p></div><strong>{plain.length}<small>profils</small></strong></section>
    <section className="structures-layout"><article className="panel"><div className="workspace-topline"><span>Profils de l’organisation</span><small>Isolation par client</small></div><div className="profiles-list">{plain.length ? plain.map((profile) => <div className="profile-row" key={profile.id}><div className="profile-avatar">{profile.name.slice(0, 2).toUpperCase()}</div><div><div className="project-title-line"><strong>{profile.name}</strong><span className={profile.status === "ready" ? "example-badge" : "draft-badge"}>{profile.status}</span></div><p>{labels[profile.profile_type] || profile.profile_type}{profile.platform ? ` · ${profile.platform}` : ""}</p>{profile.notes && <small>{profile.notes}</small>}<StructureEditForm profile={profile} /></div><form action={deleteWorkspaceProfileAction}><input type="hidden" name="id" value={profile.id} /><button className="project-delete" type="submit">Supprimer</button></form></div>) : <div className="output-empty"><strong>Aucun profil</strong><p>Ajoutez un profil générique pour préparer vos workflows.</p></div>}</div></article>
      <aside className="panel"><p className="eyebrow">Nouveau profil</p><StructureCreateForm /></aside>
    </section>
  </>;
}
