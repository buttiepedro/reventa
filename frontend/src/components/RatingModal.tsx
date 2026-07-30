import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/services/api";

interface Props {
  offerId: string;
  ratedCompanyId: string;
  ratedCompanyName: string;
  onClose: () => void;
}

export function RatingModal({ offerId, ratedCompanyId, ratedCompanyName, onClose }: Props) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!score) return;
    setSaving(true);
    try {
      await api.post("/ratings", {
        rated_company_id: ratedCompanyId,
        entity_type: "lonja_offer",
        entity_id: offerId,
        rating: score,
        comment: comment || undefined,
      });
      toast.success("¡Gracias por tu calificación!");
      onClose();
    } catch (err: unknown) {
      const detail = (err as { detail?: string }).detail;
      if (detail?.includes("409") || detail?.includes("Ya calificaste")) {
        toast.info("Ya calificaste esta operación.");
        onClose();
      } else {
        toast.error("Error al enviar la calificación.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Calificar operación</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">¿Cómo fue tu experiencia con <strong>{ratedCompanyName}</strong>?</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setScore(s)}
                className={`text-2xl transition-transform ${score >= s ? "scale-110" : "opacity-30"}`}
              >
                ★
              </button>
            ))}
          </div>
          {score > 0 && (
            <p className="text-center text-sm text-gray-500">
              {["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"][score]}
            </p>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Comentario (opcional)</label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="¿Qué destacarías de esta operación?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg">
            Ahora no
          </button>
          <button
            onClick={handleSubmit}
            disabled={!score || saving}
            className="flex-1 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Enviando..." : "Enviar calificación"}
          </button>
        </div>
      </div>
    </div>
  );
}
