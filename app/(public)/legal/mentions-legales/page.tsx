import { PLATFORM_COMPANY } from "@/lib/legal/company";
import { Logo } from "@/components/ui";
import { PublicFooter } from "@/components/public/PublicFooter";

export const metadata = {
  title: "Mentions légales",
};

export default function MentionsLegalesPage() {
  const c = PLATFORM_COMPANY;
  return (
    <>
      <main className="min-h-screen bg-bs-offwhite px-6 py-14 text-bs-black md:py-20">
        <div className="mx-auto max-w-container-narrow space-y-10">
          <header className="border-b border-black/[0.06] pb-8">
            <div className="mb-3 flex items-center justify-between">
              <Logo variant="black" size={20} withSubtitle />
              <p className="bs-eyebrow !text-bs-green-700">Document légal</p>
            </div>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-tight tracking-[-0.02em] text-bs-black">
              Mentions légales
            </h1>
          </header>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-bs-black">
              Éditeur du service
            </h2>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm text-bs-gray-700">
              <Dt>Dénomination</Dt>
              <Dd>{c.legalName}</Dd>
              <Dt>Forme juridique</Dt>
              <Dd>{c.legalForm}</Dd>
              <Dt>Capital social</Dt>
              <Dd>{c.shareCapital}</Dd>
              <Dt>Directeur de la publication</Dt>
              <Dd>{c.publicationDirector}</Dd>
              <Dt>TVA intracommunautaire</Dt>
              <Dd className="font-mono">{c.vatNumber}</Dd>
              <Dt>SIREN</Dt>
              <Dd className="font-mono">{c.siren}</Dd>
              <Dt>SIRET (siège)</Dt>
              <Dd className="font-mono">{c.siret}</Dd>
              <Dt>RCS</Dt>
              <Dd>{c.rcs}</Dd>
              <Dt>Code APE / NAF</Dt>
              <Dd className="font-mono">
                {c.apeCode} — {c.apeLabel}
              </Dd>
              <Dt>Immatriculation</Dt>
              <Dd>{c.registeredAt}</Dd>
              <Dt>Siège social</Dt>
              <Dd>
                {c.address.street}
                <br />
                {c.address.postalCode} {c.address.city}, {c.address.country}
              </Dd>
              <Dt>Site web</Dt>
              <Dd>
                <a
                  href={c.contact.web}
                  className="text-bs-green-700 underline underline-offset-[3px] hover:text-bs-black"
                  target="_blank"
                  rel="noreferrer"
                >
                  band.stream
                </a>
              </Dd>
              <Dt>Contact</Dt>
              <Dd>
                <a
                  href={`mailto:${c.contact.email}`}
                  className="text-bs-green-700 underline underline-offset-[3px] hover:text-bs-black"
                >
                  {c.contact.email}
                </a>
              </Dd>
            </dl>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-bs-black">Hébergement</h2>
            <p className="text-sm leading-[1.7] text-bs-gray-700">
              La plateforme est hébergée par <strong>{c.hosting.name}</strong>,{" "}
              {c.hosting.address} — tél. {c.hosting.phone} —{" "}
              <a
                className="text-bs-green-700 underline underline-offset-[3px] hover:text-bs-black"
                href={c.hosting.web}
                target="_blank"
                rel="noreferrer"
              >
                {c.hosting.web.replace("https://", "")}
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-bs-black">
              Statut de la plateforme
            </h2>
            <p className="text-sm leading-[1.7] text-bs-gray-700">
              BANDSTREAM SAS fournit une infrastructure technique permettant aux
              artistes utilisateurs (« vendeurs ») de commercialiser leurs
              propres produits. Conformément aux conditions générales
              d'utilisation, l'artiste reste seul vendeur (« merchant of
              record ») de chaque article mis en vente et facture lui-même les
              acheteurs. BANDSTREAM SAS n'achète, ne stocke ni ne revend les
              produits des artistes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-bs-black">Paiements</h2>
            <p className="text-sm leading-[1.7] text-bs-gray-700">
              Les paiements sont opérés par Stripe Payments Europe Limited via
              Stripe Connect. Les fonds sont versés directement sur les comptes
              bancaires des artistes vendeurs après prélèvement de la commission
              de la plateforme et des frais Stripe.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-bs-black">
              Propriété intellectuelle
            </h2>
            <p className="text-sm leading-[1.7] text-bs-gray-700">
              La marque, le logo et les contenus de la plateforme sont la
              propriété de BANDSTREAM SAS. Les contenus publiés par les artistes
              (visuels, descriptions, fichiers musicaux, photos) restent la
              propriété exclusive de leurs auteurs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-bs-black">
              Médiation de la consommation
            </h2>
            <p className="text-sm leading-[1.7] text-bs-gray-700">
              Conformément aux articles L611-1 et suivants du Code de la
              consommation, tout acheteur agissant en qualité de consommateur a
              le droit de recourir gratuitement à un médiateur de la
              consommation. <strong>Médiateur désigné :</strong>{" "}
              {c.mediation.text}
            </p>
            <p className="text-sm leading-[1.7] text-bs-gray-700">
              Plateforme européenne de règlement en ligne des litiges (RLL) :{" "}
              <a
                className="text-bs-green-700 underline underline-offset-[3px] hover:text-bs-black"
                href={c.mediation.odrUrl}
                target="_blank"
                rel="noreferrer"
              >
                ec.europa.eu/consumers/odr
              </a>
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-bs-black">
              Conditions d&apos;utilisation
            </h2>
            <p className="text-sm leading-[1.7] text-bs-gray-700">
              L&apos;utilisation du backoffice par les artistes vendeurs est
              régie par les{" "}
              <a
                className="text-bs-green-700 underline underline-offset-[3px] hover:text-bs-black"
                href="/legal/cgu-vendeurs"
              >
                CGU Vendeurs
              </a>
              . Les achats des fans sont régis par les CGV de chaque boutique,
              accessibles depuis la page de la boutique concernée.
            </p>
          </section>

          <p className="border-t border-black/[0.06] pt-6 text-xs text-bs-gray-500">
            Document mis à jour le {new Date().toISOString().slice(0, 10)} —
            version V2 (ajout directeur de publication, hébergeur, médiation).
          </p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-xs uppercase tracking-[0.08em] text-bs-gray-500">
      {children}
    </dt>
  );
}
function Dd({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <dd className={`text-sm text-bs-black ${className}`}>{children}</dd>;
}
