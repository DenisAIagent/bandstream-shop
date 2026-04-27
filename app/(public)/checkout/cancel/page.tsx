import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-dark-950 px-6 text-white">
      <div className="max-w-md space-y-4 rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
        <div className="text-4xl">↩️</div>
        <h1 className="font-display text-2xl">Paiement annulé</h1>
        <p className="text-dark-300">
          Aucun montant n'a été prélevé. Tu peux retourner à la boutique pour finaliser ta commande.
        </p>
        <Link href="/" className="inline-block rounded-full border border-dark-700 px-5 py-2 text-sm font-semibold text-white hover:border-bs-primary-400">
          Retour
        </Link>
      </div>
    </main>
  );
}
