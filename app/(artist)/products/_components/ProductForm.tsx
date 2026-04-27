"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProductAction } from "../server-actions";

type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface VariantInput {
  sku: string;
  size: string | null;
  color: string | null;
  stock: number;
  priceCents: number;
}

interface ImageInput {
  url: string;
  position: number;
  isPrimary: boolean;
}

interface FormState {
  title: string;
  shortDesc: string;
  longDesc: string;
  category: string;
  brand: string;
  basePriceCents: number;
  weightGrams: number;
  status: ProductStatus;
  variants: VariantInput[];
  images: ImageInput[];
}

interface Props {
  mode: "create" | "edit";
  productId?: string;
  initial?: FormState;
}

const empty: FormState = {
  title: "",
  shortDesc: "",
  longDesc: "",
  category: "Apparel & Accessories > Clothing > Shirts & Tops",
  brand: "",
  basePriceCents: 2500,
  weightGrams: 200,
  status: "DRAFT",
  variants: [{ sku: "DEFAULT", size: null, color: null, stock: 10, priceCents: 2500 }],
  images: [],
};

export function ProductForm({ mode, productId, initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(initial ?? empty);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function setVariant(idx: number, patch: Partial<VariantInput>) {
    setState((s) => ({
      ...s,
      variants: s.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    }));
  }

  function addVariant() {
    setState((s) => ({
      ...s,
      variants: [...s.variants, { sku: `SKU-${s.variants.length + 1}`, size: null, color: null, stock: 0, priceCents: s.basePriceCents }],
    }));
  }

  function removeVariant(idx: number) {
    setState((s) => ({ ...s, variants: s.variants.filter((_, i) => i !== idx) }));
  }

  function addImageUrl(url: string) {
    if (!url) return;
    setState((s) => ({
      ...s,
      images: [...s.images, { url, position: s.images.length, isPrimary: s.images.length === 0 }],
    }));
  }

  function removeImage(idx: number) {
    setState((s) => ({ ...s, images: s.images.filter((_, i) => i !== idx) }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveProductAction({
        mode,
        productId,
        input: state,
      });
      if (res.success) {
        router.push("/products");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-8 rounded-3xl border border-dark-800 bg-dark-900/40 p-8">
      <Section title="Informations">
        <Field label="Titre" value={state.title} onChange={(v) => update("title", v)} />
        <Field label="Description courte" value={state.shortDesc} onChange={(v) => update("shortDesc", v)} />
        <TextArea label="Description longue" value={state.longDesc} onChange={(v) => update("longDesc", v)} rows={5} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Catégorie Google" value={state.category} onChange={(v) => update("category", v)} />
          <Field label="Marque" value={state.brand} onChange={(v) => update("brand", v)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="Prix de base (centimes EUR)" value={state.basePriceCents} onChange={(v) => update("basePriceCents", v)} />
          <NumberField label="Poids (g)" value={state.weightGrams} onChange={(v) => update("weightGrams", v)} />
          <SelectStatus value={state.status} onChange={(v) => update("status", v)} />
        </div>
      </Section>

      <Section title="Variantes">
        <div className="space-y-2">
          {state.variants.map((v, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border border-dark-800 bg-dark-950 p-3">
              <input className={inputCx + " col-span-3"} placeholder="SKU" value={v.sku} onChange={(e) => setVariant(idx, { sku: e.target.value })} />
              <input className={inputCx + " col-span-2"} placeholder="Taille" value={v.size ?? ""} onChange={(e) => setVariant(idx, { size: e.target.value || null })} />
              <input className={inputCx + " col-span-2"} placeholder="Couleur" value={v.color ?? ""} onChange={(e) => setVariant(idx, { color: e.target.value || null })} />
              <input className={inputCx + " col-span-2"} type="number" min={0} placeholder="Stock" value={v.stock} onChange={(e) => setVariant(idx, { stock: Number(e.target.value) })} />
              <input className={inputCx + " col-span-2"} type="number" min={100} placeholder="Prix (c)" value={v.priceCents} onChange={(e) => setVariant(idx, { priceCents: Number(e.target.value) })} />
              <button type="button" onClick={() => removeVariant(idx)} className="col-span-1 text-xs text-red-300 hover:underline">
                Suppr
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addVariant}
            className="text-sm text-bs-primary-400 hover:underline"
          >
            + ajouter une variante
          </button>
        </div>
      </Section>

      <Section title="Images">
        <ImageInputAdder onAdd={addImageUrl} />
        <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
          {state.images.map((img, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-dark-800 bg-dark-950">
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {img.isPrimary && <span className="absolute left-1 top-1 rounded bg-bs-primary-500 px-1.5 py-0.5 text-[10px] font-bold text-dark-950">PRIMARY</span>}
              <button onClick={() => removeImage(i)} className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-500">×</button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dark-400">URL d'image directe (Cloudinary, S3, R2…). L'upload natif arrivera en V1.1.</p>
      </Section>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/products")}
          className="rounded-full border border-dark-700 px-5 py-2 text-sm text-dark-300 hover:border-dark-500"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-full bg-green-accent px-5 py-2 text-sm font-semibold text-dark-950 transition hover:bg-green-dark disabled:opacity-50"
        >
          {pending ? "Enregistrement…" : mode === "create" ? "Créer le produit" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

const inputCx = "rounded-md border border-dark-700 bg-dark-900 px-2 py-1.5 text-sm text-white outline-none focus:border-bs-primary-400";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg text-bs-primary-400">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">{label}</span>
      <input className={`w-full ${inputCx}`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">{label}</span>
      <textarea className={`w-full ${inputCx}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">{label}</span>
      <input className={`w-full ${inputCx}`} type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function SelectStatus({ value, onChange }: { value: ProductStatus; onChange: (v: ProductStatus) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-dark-400">Statut</span>
      <select
        className={`w-full ${inputCx}`}
        value={value}
        onChange={(e) => onChange(e.target.value as ProductStatus)}
      >
        <option value="DRAFT">Brouillon</option>
        <option value="PUBLISHED">Publié</option>
        <option value="ARCHIVED">Archivé</option>
      </select>
    </label>
  );
}

function ImageInputAdder({ onAdd }: { onAdd: (url: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2">
      <input
        className={`flex-1 ${inputCx}`}
        placeholder="https://… (URL image)"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          if (val) {
            onAdd(val);
            setVal("");
          }
        }}
        className="rounded-md bg-bs-primary-500 px-3 py-1.5 text-sm font-semibold text-dark-950 hover:bg-bs-primary-400"
      >
        Ajouter
      </button>
    </div>
  );
}
