import Link from "next/link";

const features = [
  {
    number: "01",
    title: "Vos comptes restent les vôtres",
    text: "Connectez vos propres comptes Meta, Gmail et outils IA. JA MAKER ne partage jamais un compte entre plusieurs clients.",
  },
  {
    number: "02",
    title: "Une seule tour de contrôle",
    text: "Préparez les contenus, lancez les automations et suivez chaque publication depuis un tableau de bord lisible.",
  },
  {
    number: "03",
    title: "Abonnement transparent",
    text: "Vous payez JA MAKER chaque mois. Les services externes restent sous votre contrôle et selon leurs propres offres.",
  },
];

export default function Home() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Link href="/" className="brand" aria-label="JA MAKER accueil">
          <span className="brand-mark">JA</span>
          <span>MAKER</span>
        </Link>
        <div className="nav-actions">
          <Link href="/login" className="text-link">Connexion</Link>
          <Link href="/register" className="button button-small">Essayer JA MAKER</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">L&apos;atelier qui transforme vos idées en actions</p>
          <h1>Créez moins à la main.<br /><span>Publiez avec méthode.</span></h1>
          <p className="hero-lead">
            JA MAKER rassemble création assistée, planification et automatisation dans un espace pensé pour les créateurs et petites équipes.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="button">Créer mon espace</Link>
            <a href="#fonctionnement" className="button button-secondary">Voir comment ça marche</a>
          </div>
          <div className="trust-row">
            <span>✓ Aucun compte partagé</span>
            <span>✓ Données isolées</span>
            <span>✓ Résiliable à tout moment</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Aperçu du tableau de bord JA MAKER">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="preview-card">
            <div className="preview-head">
              <span className="preview-logo">J</span>
              <span className="status-dot">Espace actif</span>
            </div>
            <p className="preview-label">Cette semaine</p>
            <strong className="preview-value">12 contenus</strong>
            <div className="mini-chart">
              {[42, 58, 38, 76, 62, 91, 68].map((height, index) => (
                <i key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="preview-stats">
              <span><b>4</b> prêts</span>
              <span><b>6</b> planifiés</span>
              <span><b>2</b> publiés</span>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-section" id="fonctionnement">
        <div className="section-heading">
          <p className="eyebrow">Une base saine dès le départ</p>
          <h2>Simple pour l&apos;utilisateur.<br />Solide derrière l&apos;écran.</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <span>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
