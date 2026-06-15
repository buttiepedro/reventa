import { useRef, useState } from "react";
import { vehicleService } from "../../services/vehicleService";

interface Props {
  vehicleId: string;
  onUploaded: () => void;
}

export function ImageUploader({ vehicleId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        await vehicleService.uploadImage(vehicleId, files[i], i, i === 0);
      }
      onUploaded();
    } catch {
      setError("Error al subir imagen. Intentá de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          padding: "8px 16px",
          background: uploading ? "#9ca3af" : "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: uploading ? "not-allowed" : "pointer",
          fontSize: 13,
        }}
      >
        {uploading ? "Subiendo..." : "Agregar imágenes"}
      </button>
      {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
