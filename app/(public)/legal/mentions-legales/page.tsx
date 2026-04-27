import { PLATFORM_COMPANY } from "@/lib/legal/company";

export const metadata = {
  title: "Mentions légales",
};

export default function MentionsLegalesPage() {
  const c = PLATFORM_COMPANY;
  return (
    <main className="min-h-screen bg-dark-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl space-y-10">
        <header>
          <p className="text-xs uppercase tracking-widest text-bs-primary-400">band.stream</p>
          <h1 className="mt-2 font-display text-4xl">Mentions légales</h1>
        </header>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-bs-primary-400">Éditeur du service</h2>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm text-dark-200">
            <Dt>Dénomination</Dt><Dd>{c.legalName}</Dd>
            <Dt>Forme juridique</Dt><Dd>{c.legalForm}</Dd>
            <Dt>SIREN</Dt><Dd className="font-mono">{c.siren}</Dd>
            <Dt>SIRET (siège)</Dt><Dd className="font-mono">{c.siret}</Dd>
            <Dt>RCS</Dt><Dd>{c.rcs}</Dd>
            <Dt>Code APE / NAF</Dt><Dd className="font-mono">{c.apeCode} — {c.apeLabel}</Dd>
            <Dt>Immatriculation</Dt><Dd>{c.registeredAt}</Dd>
            <Dt>Siège social</Dt>
            <Dd>
              {c.address.street}
              <br />
              {c.address.postalCode} {c.address.city}, {c.address.country}
            </Dd>
            <Dt>Contact</Dt>
            <Dd>
              <a href={`mailto:${c.contact.email}`} className="text-bs-primary-400 hover:underline">
                {c.contact.email}
              </a>
            </Dd>
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-bs-primary-400">Hébergement</h2>
          <p className="text-sm text-dark-300">
            La plateforme est hébergée par les fournisseurs cloud retenus par BANDSTREAM. La liste détaillée est tenue à
            jour et communiquée sur simple demande à <a className="text-bs-primary-400 hover:underline" href={`mailto:${c.contact.email}`}>{c.contact.email}</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-bs-primary-400">Statut de la plateforme</h2>
          <p className="text-sm text-dark-300">
            BANDSTREAM SAS fournit une infrastructure technique permettant aux artistes utilisateurs (« vendeurs ») de commercialiser leurs propres produits. Conformément aux conditions générales d'utilisation, l'artiste reste seul vendeur (« merchant of record ») de chaque article mis en vente et facture lui-même les acheteurs. BANDSTREAM SAS n'achète, ne stocke ni ne revend les produits des artistes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-bs-primary-400">Paiements</h2>
          <p className="text-sm text-dark-300">
            Les paiements sont opérés par Stripe Payments Europe Limited via Stripe Connect. Les fonds sont versés directement sur les comptes bancaires des artistes vendeurs après prélèvement de la commission de la plateforme et des frais Stripe.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-bs-primary-400">Propriété intellectuelle</h2>
          <p className="text-sm text-dark-300">
            La marque, le logo et les contenus de la plateforme sont la propriété de BANDSTREAM SAS. Les contenus publiés par les artistes (visuels, descriptions, fichiers musicaux, photos) restent la propriété exclusive de leurs auteurs.
          </p>
        </section>

        <p className="border-t border-dark-800 pt-6 text-xs text-dark-500">
          Document mis à jour le {new Date().toISOString().slice(0, 10)} — version V1.
        </p>
      </div>
    </main>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="text-xs uppercase tracking-wider text-dark-400">{children}</dt>;
}
function Dd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <dd className={`text-sm text-white ${className}`}>{children}</dd>;
}
