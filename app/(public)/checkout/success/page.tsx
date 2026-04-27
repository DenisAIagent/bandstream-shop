import Link from "next/link";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-dark-950 px-6 text-white">
      <div className="max-w-md space-y-4 rounded-3xl border border-bs-primary-500/30 bg-bs-primary-500/5 p-8 text-center">
        <div className="text-4xl">🎉</div>
        <h1 className="font-display text-3xl">Merci pour ta commande !</h1>
        <p className="text-dark-300">
          Tu vas recevoir un email de confirmation avec le détail. L'artiste prépare ton colis.
        </p>
        {sp.session_id && (
          <p className="font-mono text-xs text-dark-500">ref · {sp.session_id.slice(0, 14)}…</p>
        )}
        <Link href="/" className="inline-block rounded-full bg-green-accent px-5 py-2 text-sm font-semibold text-dark-950 hover:bg-green-dark">
          Retour à band.stream
        </Link>
      </div>
    </main>
  );
}
