import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { vehicleService } from "@/services/vehicleService";
import { Spinner } from "@/components/ui/Spinner";
import type { VehiclePublic } from "@/types/vehicle";

const FUEL_LABELS: Record<string, string> = {
  gasoline: "Nafta", diesel: "Diesel", electric: "Eléctrico", hybrid: "Híbrido", gnc: "GNC",
};

export function PublicShare() {
  const { token } = useParams<{ token: string }>();
  const [vehicle, setVehicle] = useState<VehiclePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!token) return;
    vehicleService.getPublic(token)
      .then(setVehicle)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner />
      </div>
    );
  }

  if (notFound || !vehicle) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <p className="text-5xl mb-4">🚗</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Vehículo no encontrado</h1>
        <p className="text-gray-500 text-sm">Este link puede haber expirado o ser inválido.</p>
      </div>
    );
  }

  const images = vehicle.images ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Branding bar */}
      <div className="bg-blue-700 px-4 py-3">
        <div className="max-w-4xl mx-auto text-white font-black text-lg tracking-tight">Reventa</div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gallery */}
          <div>
            <div className="w-full aspect-[4/3] bg-gray-200 rounded-xl overflow-hidden mb-3">
              {images[activeImg] ? (
                <img src={images[activeImg].url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">Sin imagen</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt=""
                    onClick={() => setActiveImg(i)}
                    className={`w-16 h-12 object-cover rounded-lg cursor-pointer transition-all ${
                      i === activeImg ? "ring-2 ring-blue-500" : "opacity-60 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1">
              {vehicle.brand} {vehicle.model} <span className="font-normal text-gray-500">{vehicle.year}</span>
            </h1>
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

            {vehicle.description && (
              <p className="text-gray-600 text-sm leading-relaxed mb-6">{vehicle.description}</p>
            )}

            <div className="bg-blue-50 rounded-xl p-4 text-blue-700 text-sm font-medium">
              ¿Interesado? Contactá a tu concesionaria de confianza para más información.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
