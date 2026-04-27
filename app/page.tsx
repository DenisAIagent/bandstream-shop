import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-dark-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center gap-8 px-6 py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-bs-primary-500/30 bg-bs-primary-500/10 px-3 py-1 text-xs uppercase tracking-widest text-bs-primary-300">
          <span className="h-2 w-2 rounded-full bg-bs-primary-400" />
          band.stream · Shop
        </div>
        <h1 className="font-display text-5xl leading-tight md:text-7xl">
          La boutique merch
          <br />
          <span className="text-bs-primary-400">de tes fans.</span>
        </h1>
        <p className="max-w-xl text-lg text-dark-300">
          Vendez vos vinyles, T-shirts et accessoires sans friction. Connecté à Stripe, Google Shopping et Instagram. Gardez 97 % de chaque vente avec le plan Pro.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/register"
            className="rounded-full bg-green-accent px-6 py-3 font-semibold text-dark-950 transition hover:bg-green-dark"
          >
            Activer ma boutique
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-dark-700 px-6 py-3 font-semibold text-white transition hover:border-bs-primary-400"
          >
            Se connecter
          </Link>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
            <div className="font-display text-3xl text-bs-primary-400">3 %</div>
            <div className="mt-1 text-sm text-dark-400">de commission par vente. Pas de frais cachés.</div>
          </div>
          <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
            <div className="font-display text-3xl text-bs-primary-400">10 €</div>
            <div className="mt-1 text-sm text-dark-400">par mois pour le plan Pro avec boutique incluse.</div>
          </div>
          <div className="rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
            <div className="font-display text-3xl text-bs-primary-400">0 €</div>
            <div className="mt-1 text-sm text-dark-400">de frais Stripe Connect facturés en plus par band.stream.</div>
          </div>
        </div>
      </section>
    </main>
  );
}
