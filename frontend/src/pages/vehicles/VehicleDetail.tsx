import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { vehicleService } from "@/services/vehicleService";
import { ImageUploader } from "@/components/vehicles/ImageUploader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";
import type { Vehicle } from "@/types/vehicle";

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Nafta", diesel: "Diesel", electric: "Eléctrico", hybrid: "Híbrido", gnc: "GNC",
};

const STATUS_TONE: Record<string, "green" | "yellow" | "red"> = {
  available: "green", reserved: "yellow", sold: "red",
};
const STATUS_LABELS: Record<string, string> = {
  available: "Disponible", reserved: "Reservado", sold: "Vendido",
};

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      setVehicle(await vehicleService.get(id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const isOwner = user && vehicle && user.company_id === vehicle.company_id;
  const canEdit = isOwner || user?.role === "super_admin";

  const copyShareLink = () => {
    if (!vehicle) return;
    navigator.clipboard.writeText(`${window.location.origin}/share/${vehicle.share_token}`);
    setCopied(true);
    toast.success("Link copiado al portapapeles.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!id) return;
    await vehicleService.setPrimaryImage(id, imageId);
    load();
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!id || !window.confirm("¿Eliminar esta imagen?")) return;
    await vehicleService.deleteImage(id, imageId);
    load();
  };

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;
  if (!vehicle) return <div className="text-red-600 p-10">Vehículo no encontrado.</div>;

  const images = vehicle.images ?? [];

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Top bar */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          ← Volver
        </button>
        {canEdit && (
          <Link to={`/vehicles/${id}/edit`}>
            <Button variant="secondary" size="sm">Editar</Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gallery */}
        <div>
          <div className="w-full aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden mb-3">
            {images[activeImg] ? (
              <img src={images[activeImg].url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">Sin imagen</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={img.id} className="relative">
                  <img
                    src={img.url}
                    alt=""
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-12 object-cover rounded-lg cursor-pointer transition-all ${
                      i === activeImg ? "ring-2 ring-blue-500" : "opacity-70 hover:opacity-100"
                    }`}
                  />
                  {img.is_primary && (
                    <span className="absolute top-0.5 left-0.5 bg-blue-600 text-white text-[9px] px-1 rounded">★</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="mt-4 space-y-3">
              <ImageUploader vehicleId={vehicle.id} onUploaded={load} />
              {images.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {images.map((img, i) => (
                    <span key={img.id} className="flex gap-2 text-xs">
                      <button onClick={() => handleSetPrimary(img.id)} className="text-blue-600 hover:underline">
                        {img.is_primary ? "★ Principal" : "Hacer principal"}
                      </button>
                      <span className="text-gray-300">·</span>
                      <button onClick={() => handleDeleteImage(img.id)} className="text-red-500 hover:underline">
                        Eliminar {i + 1}
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{vehicle.company_name}</p>
          <div className="flex items-start gap-3 mb-1">
            <h1 className="text-2xl font-black text-gray-900">
              {vehicle.brand} {vehicle.model} <span className="font-normal text-gray-500">{vehicle.year}</span>
            </h1>
            <Badge tone={STATUS_TONE[vehicle.status] ?? "gray"} className="mt-1 shrink-0">
              {STATUS_LABELS[vehicle.status]}
            </Badge>
          </div>
          {vehicle.version && <p className="text-gray-500 mb-4">{vehicle.version}</p>}

          <div className="flex flex-wrap gap-2 mb-6">
            {[
              `${vehicle.mileage.toLocaleString()} km`,
              FUEL_LABELS[vehicle.fuel_type] ?? vehicle.fuel_type,
              vehicle.transmission === "manual" ? "Manual" : "Automático",
              vehicle.condition === "new" ? "Nuevo" : "Usado",
              vehicle.body_type,
              vehicle.color,
            ].filter(Boolean).map((tag) => (
              <span key={tag} className="bg-gray-100 text-gray-700 rounded-lg px-3 py-1 text-sm">{tag}</span>
            ))}
          </div>

          <div className="bg-blue-50 rounded-xl p-5 mb-6">
            <div className="mb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Precio reventa</p>
              <p className="text-3xl font-black text-blue-700">${Number(vehicle.price_resale).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Precio público</p>
              <p className="text-xl font-bold text-gray-700">${Number(vehicle.price_public).toLocaleString()}</p>
            </div>
          </div>

          {vehicle.description && (
            <p className="text-gray-600 text-sm leading-relaxed mb-6">{vehicle.description}</p>
          )}

          <Button
            variant={copied ? "primary" : "secondary"}
            onClick={copyShareLink}
          >
            {copied ? "¡Link copiado!" : "Copiar link público"}
          </Button>
        </div>
      </div>
    </div>
  );
}
