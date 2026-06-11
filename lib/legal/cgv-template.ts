/**
 * Template CGV auto-généré à l'activation de la boutique.
 *
 * L'artiste / le label est le **vendeur réel** (le fan paie directement
 * via Stripe Connect sur son compte). band.stream est seulement la
 * plateforme technique. Donc les CGV doivent être au nom de l'artiste,
 * pas de band.stream — sinon imbroglio juridique en cas de litige.
 *
 * V1 : template par défaut pré-rempli. L'artiste peut éditer ensuite via
 * le système de pages CMS (slug réservé `cgv`). V1.x : éditeur dédié
 * avec champs structurés (forme légale, SIREN, adresse, IBAN…).
 */

interface CgvShop {
  displayName: string;
  contactEmail: string;
}

export function defaultCgvBody(shop: CgvShop): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `## Conditions Générales de Vente

**Vendeur :** ${shop.displayName}
**Contact :** ${shop.contactEmail}
**Plateforme technique :** band.stream Shop (BANDSTREAM SAS, SIREN 939 221 438)
**Dernière mise à jour :** ${today}

⚠️ **À compléter par l'artiste / le label** : forme légale, SIREN/SIRET,
adresse postale du siège, numéro de TVA intracommunautaire si applicable.

### 1. Objet

Les présentes Conditions Générales de Vente (CGV) régissent toute
commande passée par un acheteur (« le Fan ») sur la boutique en ligne
de ${shop.displayName} (« le Vendeur ») hébergée par la plateforme
band.stream Shop.

### 2. Produits

Les caractéristiques essentielles des produits sont présentées sur
chaque fiche produit (taille, couleur, matière, photos). Le Vendeur se
réserve le droit de modifier l'offre à tout moment.

### 3. Prix

Les prix sont indiqués en euros toutes taxes comprises (TTC). Les frais
de livraison sont calculés au moment du checkout selon le pays de
livraison et affichés avant validation de la commande.

Si le Vendeur bénéficie de la franchise en base de TVA, ses factures
portent la mention « TVA non applicable, art. 293 B du CGI » et les prix
s'entendent nets de taxe.

### 4. Commande & paiement

La commande est passée via le panier puis validée sur la page de
paiement sécurisée Stripe (carte bancaire, Apple Pay, Google Pay).
Le paiement est immédiat. Une commande validée engage le Fan.

### 5. Livraison

Les délais de livraison sont indiqués sur chaque fiche produit
(préparation par le Vendeur + transit transporteur). Le Vendeur
s'engage à expédier dans les délais annoncés. Les colis sont expédiés
à l'adresse renseignée par le Fan au checkout.

À défaut de délai indiqué, la livraison intervient au plus tard
**trente (30) jours** après la commande (article L216-1 du Code de la
consommation). Passé ce délai et après mise en demeure restée sans
effet, le Fan peut résoudre la commande et obtenir son remboursement
intégral sous 14 jours.

### 6. Droit de rétractation

Conformément à l'article L221-18 du Code de la consommation, le Fan
dispose d'un délai de **14 jours** à compter de la réception du colis
pour exercer son droit de rétractation, sans avoir à motiver sa
décision. Pour exercer ce droit, le Fan contacte le Vendeur par email
(${shop.contactEmail}), par déclaration dénuée d'ambiguïté ou en
utilisant le formulaire type reproduit en annexe des présentes CGV. Le
remboursement intervient sous 14 jours à compter de la rétractation
(le Vendeur peut le différer jusqu'à récupération du bien ou preuve
d'expédition du retour). Les frais de retour sont à la charge du
Vendeur sauf mention contraire (modifier ce point selon la politique
choisie).

### 6 bis. Exceptions au droit de rétractation

Conformément à l'article **L221-28** du Code de la consommation, le
droit de rétractation ne peut pas être exercé pour :

- les biens confectionnés selon les spécifications du Fan ou nettement
  personnalisés (3°) — par exemple un article gravé ou imprimé à la
  demande ;
- les enregistrements audio/vidéo ou logiciels descellés par le Fan
  après la livraison (9°) ;
- les **contenus numériques fournis sur un support immatériel**
  (fichiers téléchargeables) dont l'exécution a commencé **avec
  l'accord préalable exprès du Fan et son renoncement exprès à son
  droit de rétractation** (13°). Ce renoncement est recueilli au moment
  du paiement : la page de paiement l'indique explicitement avant
  validation et le lien de téléchargement est délivré immédiatement
  après le paiement.

### 7. Garanties légales

Les produits bénéficient des garanties légales de conformité (articles
L217-4 et suivants du Code de la consommation) et des vices cachés
(articles 1641 et suivants du Code civil).

### 8. Données personnelles

Le Vendeur collecte les données nécessaires au traitement de la
commande (nom, email, adresse). Ces données ne sont pas revendues. Le
Fan dispose d'un droit d'accès, de rectification et de suppression
(article 17 RGPD) en écrivant à ${shop.contactEmail}.

### 8 bis. Communication commerciale

Si le Fan a coché la case d'acceptation des offres lors du paiement, il
peut recevoir un email de rappel de panier assorti le cas échéant d'une
offre promotionnelle, ainsi que des communications du Vendeur. Chaque
email comporte un moyen de désinscription. Sans cet accord, seuls les
emails strictement nécessaires à la commande sont envoyés.

### 9. Médiation et litiges

Conformément aux articles L611-1 et suivants du Code de la
consommation, le Fan consommateur peut recourir gratuitement à un
médiateur de la consommation. Médiateur désigné par la plateforme :
en cours de désignation — dans l'attente, toute réclamation peut être
adressée au Vendeur (${shop.contactEmail}) ou à contact@band.stream.
Le Fan peut également recourir à la plateforme européenne de règlement
des litiges en ligne (ODR) :
[ec.europa.eu/consumers/odr](https://ec.europa.eu/consumers/odr).
À défaut de résolution amiable, le litige relève des juridictions
compétentes dans les conditions du droit commun ; le Fan consommateur
peut saisir la juridiction de son lieu de résidence.

### 10. Loi applicable

Les présentes CGV sont régies par le droit français.

---

### Annexe — Formulaire type de rétractation

*(À compléter et renvoyer uniquement si vous souhaitez vous rétracter
de la commande, sauf exceptions de l'article 6 bis.)*

À l'attention de ${shop.displayName} (${shop.contactEmail}) :

Je vous notifie par la présente ma rétractation du contrat portant sur
la vente du/des bien(s) ci-dessous :

- Commande n° : …
- Commandé le : … / Reçu le : …
- Nom du consommateur : …
- Adresse du consommateur : …
- Date : …
`;
}
