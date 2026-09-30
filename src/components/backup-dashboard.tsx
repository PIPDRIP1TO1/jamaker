import { RestoreForm } from "@/components/restore-form";

export function BackupDashboard({ projectCount }: { projectCount: number }) {
  return <>
    <section className="backup-hero"><div><span className="pill">Export sécurisé</span><h2>Vos données restent récupérables.</h2><p>L&apos;export contient vos projets, configurations et historiques. Les mots de passe, sessions et tokens ne sont jamais inclus.</p></div><a className="button" href="/api/export">Télécharger mon export JSON</a></section>
    <section className="backup-grid"><article className="panel"><p className="eyebrow">Contenu</p><h2>{projectCount} projet(s)</h2><ul className="backup-list"><li>Projets et résultats</li><li>Nœuds et connexions Workflow</li><li>Jobs et plannings Automation</li><li>Metadata des intégrations</li></ul></article><article className="panel"><p className="eyebrow">Exclusions de sécurité</p><h2>Secrets jamais exportés</h2><ul className="backup-list secure"><li>Mots de passe utilisateur</li><li>Cookies et sessions</li><li>Tokens OAuth</li><li>Clés API</li></ul></article></section>
    <section className="panel backup-restore"><div><p className="eyebrow">Restauration non destructive</p><h2>Importer un export JA MAKER</h2><p>Les projets sont ajoutés comme nouveaux brouillons avec leurs résultats et graphes. Les données actuelles ne sont ni remplacées ni supprimées, les comptes externes sont retirés, et les plannings sont restaurés inactifs.</p></div><RestoreForm /></section>
  </>;
}
