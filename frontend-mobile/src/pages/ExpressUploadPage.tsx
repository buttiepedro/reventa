import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

interface CatalogItem {
  brand: string;
  models: string[];
}

type Step = 1 | 2 | 3;

interface FormData {
  brand: string;
  model: string;
  year: string;
  km: string;
  price_toma: string;
  photos: File[];
  previews: string[];
}

function resizeImage(file: File, maxPx = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => resolve(b!), "image/jpeg", quality);
    };
    img.src = url;
  });
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => String(CURRENT_YEAR - i));

export function ExpressUploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({ brand: "", model: "", year: String(CURRENT_YEAR), km: "", price_toma: "", photos: [], previews: [] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 3 - form.photos.length;
    const toAdd = files.slice(0, remaining);
    const previews = toAdd.map((f) => URL.createObjectURL(f));
    setForm((prev) => ({ ...prev, photos: [...prev.photos, ...toAdd], previews: [...prev.previews, ...previews] }));
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setForm((prev) => {
      URL.revokeObjectURL(prev.previews[idx]);
      return {
        ...prev,
        photos: prev.photos.filter((_, i) => i !== idx),
        previews: prev.previews.filter((_, i) => i !== idx),
      };
    });
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const vehicleRes = await api.post<{ id: string }>("/vehicles", {
        brand: form.brand,
        model: form.model,
        year: Number(form.year),
        km: Number(form.km),
        price_toma: Number(form.price_toma),
        price_resale: Number(form.price_toma),
        status: "pre_toma",
        condition: "used",
        fuel_type: "gasoline",
        transmission: "manual",
      });

      for (let i = 0; i < form.photos.length; i++) {
        const blob = await resizeImage(form.photos[i]);
        const fd = new FormData();
        fd.append("file", blob, `photo_${i}.jpg`);
        fd.append("display_order", String(i));
        fd.append("is_primary", String(i === 0));
        await api.postForm(`/vehicles/${vehicleRes.id}/images/upload`, fd);
      }

      navigate(`/express/${vehicleRes.id}`, { replace: true });
    } catch (err: unknown) {
      setError((err as { detail?: string }).detail ?? "Error al publicar. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const canStep1 = form.photos.length >= 1;
  const canStep2 = form.brand && form.model && form.year && form.km && form.price_toma;

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => step > 1 ? setStep((s) => (s - 1) as Step) : navigate("/")} style={{ fontSize: 22, color: "var(--gray-700)", padding: 4 }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "var(--gray-900)" }}>Nueva Pre-Toma</h1>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {([1, 2, 3] as Step[]).map((s) => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: step >= s ? "var(--green)" : "var(--gray-200)" }} />
            ))}
          </div>
        </div>
        <span style={{ fontSize: 13, color: "var(--gray-400)" }}>{step}/3</span>
      </div>

      {/* Step 1 — Photos */}
      {step === 1 && (
        <>
          <div className="card">
            <p style={{ fontWeight: 600, marginBottom: 12, color: "var(--gray-900)" }}>Fotos del vehículo</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {form.previews.map((url, idx) => (
                <div key={idx} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden" }}>
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    onClick={() => removePhoto(idx)}
                    style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", color: "#fff", borderRadius: "50%", width: 22, height: 22, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {form.photos.length < 3 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{ aspectRatio: "1", borderRadius: 10, border: "2px dashed var(--gray-300)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--gray-400)", fontSize: 13 }}
                >
                  <span style={{ fontSize: 28 }}>📷</span>
                  Foto
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={addPhoto} />
            <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 8 }}>Frente · Lateral · Interior (mín. 1)</p>
          </div>
          <button className="btn-primary" disabled={!canStep1} onClick={() => setStep(2)}>
            Siguiente →
          </button>
        </>
      )}

      {/* Step 2 — Datos */}
      {step === 2 && (
        <>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontWeight: 600, color: "var(--gray-900)" }}>Datos del vehículo</p>
            <input className="input-field" placeholder="Marca (ej: Toyota)" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
            <input className="input-field" placeholder="Modelo (ej: Corolla)" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
            <select className="input-field" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <input className="input-field" type="number" placeholder="Kilometraje" inputMode="numeric" value={form.km} onChange={(e) => setForm((f) => ({ ...f, km: e.target.value }))} />
            <input className="input-field" type="number" placeholder="Precio ofrecido $" inputMode="numeric" value={form.price_toma} onChange={(e) => setForm((f) => ({ ...f, price_toma: e.target.value }))} />
          </div>
          <button className="btn-primary" disabled={!canStep2} onClick={() => setStep(3)}>
            Siguiente →
          </button>
        </>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <>
          <div className="card">
            <p style={{ fontWeight: 600, marginBottom: 12, color: "var(--gray-900)" }}>Confirmar Pre-Toma</p>
            {form.previews[0] && (
              <img src={form.previews[0]} alt="" style={{ width: "100%", borderRadius: 10, objectFit: "cover", maxHeight: 180, marginBottom: 12 }} />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 14 }}>
              {[
                ["Marca", form.brand],
                ["Modelo", form.model],
                ["Año", form.year],
                ["Km", Number(form.km).toLocaleString()],
                ["Precio", `$${Number(form.price_toma).toLocaleString()}`],
                ["Fotos", `${form.photos.length} foto${form.photos.length > 1 ? "s" : ""}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ fontSize: 11, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                  <p style={{ fontWeight: 600, color: "var(--gray-900)" }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
          {error && <p style={{ fontSize: 13, color: "var(--red)", textAlign: "center" }}>{error}</p>}
          <button className="btn-primary" disabled={submitting} onClick={handleSubmit} style={{ fontSize: 17 }}>
            {submitting ? "Publicando..." : "¡Publicar Pre-Toma!"}
          </button>
          <button className="btn-secondary" onClick={() => setStep(2)} disabled={submitting}>
            Editar datos
          </button>
        </>
      )}
    </div>
  );
}
