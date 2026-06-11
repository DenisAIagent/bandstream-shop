import { PLATFORM_COMPANY } from "@/lib/legal/company";
import { Logo } from "@/components/ui";
import { PublicFooter } from "@/components/public/PublicFooter";

export const metadata = {
  title: "CGU Vendeurs",
};

/**
 * Conditions Générales d'Utilisation — Artistes vendeurs (backoffice shop).
 * Structure et blocs société alignés sur les CGU de la plateforme smartlink
 * (même société éditrice, bandstream-app/content/legal). Contractualise ce
 * qui n'existait que dans le code : commission, suspension, responsabilités.
 * Acceptées à l'inscription (case « J'accepte » du formulaire vendeur).
 */
export default function CguVendeursPage() {
  const c = PLATFORM_COMPANY;
  return (
    <>
      <main className="min-h-screen bg-bs-offwhite px-6 py-14 text-bs-black md:py-20">
        <div className="mx-auto max-w-container-narrow space-y-8">
          <header className="border-b border-black/[0.06] pb-8">
            <div className="mb-3 flex items-center justify-between">
              <Logo variant="black" size={20} withSubtitle />
              <p className="bs-eyebrow !text-bs-green-700">Document légal</p>
            </div>
            <h1 className="mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-tight tracking-[-0.02em] text-bs-black">
              CGU Vendeurs — band.stream Shop
            </h1>
            <p className="mt-2 text-sm text-bs-gray-700">
              {c.legalName} {c.legalForm}, capital {c.shareCapital}, RCS {c.rcs}{" "}
              {c.siren}, siège {c.address.street}, {c.address.postalCode}{" "}
              {c.address.city}. Directeur de la publication :{" "}
              {c.publicationDirector}.
            </p>
          </header>

          <Section title="1. Objet">
            Les présentes conditions régissent l&apos;utilisation du backoffice
            band.stream Shop par les artistes et labels (« le Vendeur ») pour
            créer et exploiter une boutique de merchandising. Elles complètent
            les CGU de la plateforme band.stream, que le Vendeur a déjà
            acceptées pour son compte principal.
          </Section>

          <Section title="2. Rôle de la plateforme">
            BANDSTREAM SAS fournit une infrastructure technique (catalogue,
            paiement via Stripe Connect, emails transactionnels, outils
            marketing). <strong>Le Vendeur est l&apos;unique vendeur</strong>{" "}
            (« merchant of record ») des produits mis en vente : il encaisse
            directement les paiements sur son compte Stripe, émet les factures
            et répond des obligations du vendeur professionnel (conformité,
            garanties légales, rétractation, TVA). BANDSTREAM n&apos;achète,
            ne stocke ni ne revend les produits.
          </Section>

          <Section title="3. Accès au service — add-on Boutique">
            L&apos;accès vendeur requiert l&apos;add-on payant « Boutique
            merch » souscrit sur le compte band.stream principal : +10 €/mois
            sur le plan Pro (1 boutique), +30 €/mois sur le plan Label
            (jusqu&apos;à 100 boutiques). Le plan Free n&apos;y est pas
            éligible. La désactivation de l&apos;add-on suspend l&apos;accès au
            backoffice ; les boutiques sont alors dépubliées, les données
            conservées 30 jours puis traitées selon la politique de
            confidentialité.
          </Section>

          <Section title="4. Commission et frais">
            BANDSTREAM perçoit, via le mécanisme de frais de plateforme Stripe,
            une commission sur chaque commande encaissée :{" "}
            <strong>plan Pro : 3 % du montant TTC, minimum 0,30 € par
            commande ; plan Label : 0 %</strong>. Les frais du prestataire de
            paiement Stripe (à titre indicatif 1,4 % + 0,25 € par transaction
            européenne) restent à la charge du Vendeur et sont prélevés
            directement par Stripe. Toute évolution de la commission est
            notifiée par email au moins <strong>trente (30) jours</strong>{" "}
            avant son entrée en vigueur ; le Vendeur peut résilier avant cette
            date.
          </Section>

          <Section title="5. Obligations du Vendeur">
            Le Vendeur s&apos;engage à : (a) renseigner des informations
            légales exactes et complètes (identité, forme juridique,
            SIREN/SIRET, adresse, régime de TVA) avant sa première vente —
            elles figurent sur ses CGV et factures ; (b) ne vendre que des
            produits licites dont il détient les droits — la contrefaçon
            (produits, visuels, enregistrements) entraîne la suspension
            immédiate ; (c) expédier dans les délais annoncés et au plus tard
            sous 30 jours (art. L216-1 C. conso.) ; (d) honorer le droit de
            rétractation, les garanties légales et le service après-vente de
            ses clients ; (e) respecter ses obligations fiscales et sociales.
          </Section>

          <Section title="6. Données personnelles">
            Pour les données de ses acheteurs (identité, adresses, historique
            de commandes), le Vendeur est <strong>responsable de
            traitement</strong> ; BANDSTREAM agit comme sous-traitant au sens
            de l&apos;article 28 du RGPD (hébergement, emails, outils). Le
            Vendeur ne peut utiliser les emails de ses clients à des fins de
            prospection que dans le respect de l&apos;opt-in recueilli au
            paiement, et s&apos;interdit de revendre ces données. Les
            acheteurs disposent d&apos;un export et d&apos;un effacement
            self-serve depuis leur compte fan ; le Vendeur transmet à{" "}
            {c.dpoEmail} toute demande RGPD qu&apos;il ne peut traiter seul.
          </Section>

          <Section title="7. Propriété intellectuelle">
            Le Vendeur conserve l&apos;intégralité de ses droits sur ses
            contenus (visuels, fichiers audio, descriptions). Il accorde à
            BANDSTREAM une licence non exclusive, gratuite, mondiale et
            limitée à la durée d&apos;utilisation du service, aux seules fins
            techniques d&apos;exploitation de la boutique (affichage,
            miniatures, flux produits vers Google/Meta s&apos;il les active).
          </Section>

          <Section title="8. Suspension et résiliation">
            BANDSTREAM peut suspendre une boutique en cas de violation des
            présentes (contrefaçon, fraude, produits illicites, défaut
            d&apos;informations légales), après mise en demeure restée sans
            effet sous 7 jours — sauf urgence manifeste (fraude, contenu
            illicite) justifiant une suspension immédiate. Le Vendeur dispose
            d&apos;un recours via {c.contact.email}. Le Vendeur peut cesser à
            tout moment en désactivant l&apos;add-on ; les commandes en cours
            doivent être honorées.
          </Section>

          <Section title="9. Responsabilité">
            BANDSTREAM est tenue d&apos;une obligation de moyens sur la
            disponibilité du service. Elle n&apos;est pas partie au contrat de
            vente entre le Vendeur et ses clients et n&apos;assume aucune
            responsabilité au titre des produits, de leur livraison ou de leur
            conformité. Le Vendeur garantit BANDSTREAM contre toute
            réclamation de tiers liée à ses produits ou contenus.
          </Section>

          <Section title="10. Modification, médiation, droit applicable">
            Toute modification substantielle des présentes est notifiée au
            moins 30 jours avant son entrée en vigueur. Médiation de la
            consommation (pour les vendeurs consommateurs) : {c.mediation.text}{" "}
            Les présentes sont régies par le droit français ; compétence des
            tribunaux du ressort du siège de BANDSTREAM pour les vendeurs
            professionnels.
          </Section>

          <p className="border-t border-black/[0.06] pt-6 text-xs text-bs-gray-500">
            Document mis à jour le {new Date().toISOString().slice(0, 10)} —
            version V1. Acceptées lors de la création du compte vendeur.
          </p>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl text-bs-black">{title}</h2>
      <p className="text-sm leading-[1.7] text-bs-gray-700">{children}</p>
    </section>
  );
}
