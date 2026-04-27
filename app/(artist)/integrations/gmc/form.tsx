"use client";

import { useState } from "react";

export function GmcConnectForm() {
  const [merchantId, setMerchantId] = useState("");
  const start = () => {
    const url = new URL("/api/gmc/oauth", window.location.origin);
    if (merchantId) {
      // We pass merchant_id via cookie-less query that callback re-reads.
      window.sessionStorage.setItem("bs_gmc_merchant_id", merchantId);
      url.searchParams.set("merchant_id", merchantId);
    }
    window.location.href = url.toString();
  };
  return (
    <div className="space-y-3 rounded-2xl border border-dark-800 bg-dark-900/40 p-6">
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">Merchant ID Google</span>
        <input
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
          placeholder="123456789"
          className="w-full rounded-lg border border-dark-700 bg-dark-950 px-3 py-2 font-mono text-white outline-none focus:border-bs-primary-400"
        />
      </label>
      <button
        type="button"
        onClick={start}
        disabled={!merchantId}
        className="rounded-full bg-bs-primary-500 px-5 py-2 text-sm font-semibold text-dark-950 transition hover:bg-bs-primary-400 disabled:opacity-50"
      >
        Connecter mon compte Google
      </button>
    </div>
  );
}
