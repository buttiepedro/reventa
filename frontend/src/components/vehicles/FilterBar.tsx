import type { VehicleFilters } from "@/types/vehicle";

interface Props {
  filters: VehicleFilters;
  onChange: (filters: VehicleFilters) => void;
}

const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white";

export function FilterBar({ filters, onChange }: Props) {
  const set = (key: keyof VehicleFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined, page: 1 });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-end">
        <input
          className={`${inputCls} w-32`}
          placeholder="Marca"
          value={filters.brand ?? ""}
          onChange={(e) => set("brand", e.target.value)}
        />
        <input
          className={`${inputCls} w-32`}
          placeholder="Modelo"
          value={filters.model ?? ""}
          onChange={(e) => set("model", e.target.value)}
        />
        <input
          type="number"
          className={`${inputCls} w-24`}
          placeholder="Año desde"
          value={filters.year_min ?? ""}
          onChange={(e) => set("year_min", e.target.value)}
        />
        <input
          type="number"
          className={`${inputCls} w-24`}
          placeholder="Año hasta"
          value={filters.year_max ?? ""}
          onChange={(e) => set("year_max", e.target.value)}
        />
        <select className={inputCls} value={filters.fuel_type ?? ""} onChange={(e) => set("fuel_type", e.target.value)}>
          <option value="">Combustible</option>
          <option value="gasoline">Nafta</option>
          <option value="diesel">Diesel</option>
          <option value="electric">Eléctrico</option>
          <option value="hybrid">Híbrido</option>
          <option value="gnc">GNC</option>
        </select>
        <select className={inputCls} value={filters.transmission ?? ""} onChange={(e) => set("transmission", e.target.value)}>
          <option value="">Transmisión</option>
          <option value="manual">Manual</option>
          <option value="automatic">Automático</option>
        </select>
        <select className={inputCls} value={filters.condition ?? ""} onChange={(e) => set("condition", e.target.value)}>
          <option value="">Condición</option>
          <option value="new">Nuevo</option>
          <option value="used">Usado</option>
        </select>
        <select className={inputCls} value={filters.status ?? "available"} onChange={(e) => set("status", e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="available">Disponible</option>
          <option value="reserved">Reservado</option>
          <option value="sold">Vendido</option>
        </select>
        <button
          onClick={() => onChange({ page: 1, page_size: 20, status: "available" })}
          className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
