import type { VehicleFilters, FuelType, Transmission, VehicleCondition, VehicleStatus } from "../../types/vehicle";

interface Props {
  filters: VehicleFilters;
  onChange: (filters: VehicleFilters) => void;
}

export function FilterBar({ filters, onChange }: Props) {
  const set = (key: keyof VehicleFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined, page: 1 });
  };

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 0" }}>
      <input
        placeholder="Marca"
        value={filters.brand ?? ""}
        onChange={(e) => set("brand", e.target.value)}
        style={inputStyle}
      />
      <input
        placeholder="Modelo"
        value={filters.model ?? ""}
        onChange={(e) => set("model", e.target.value)}
        style={inputStyle}
      />
      <input
        type="number"
        placeholder="Año desde"
        value={filters.year_min ?? ""}
        onChange={(e) => set("year_min", e.target.value)}
        style={{ ...inputStyle, width: 100 }}
      />
      <input
        type="number"
        placeholder="Año hasta"
        value={filters.year_max ?? ""}
        onChange={(e) => set("year_max", e.target.value)}
        style={{ ...inputStyle, width: 100 }}
      />
      <select value={filters.fuel_type ?? ""} onChange={(e) => set("fuel_type", e.target.value)} style={inputStyle}>
        <option value="">Combustible</option>
        <option value="gasoline">Nafta</option>
        <option value="diesel">Diesel</option>
        <option value="electric">Eléctrico</option>
        <option value="hybrid">Híbrido</option>
        <option value="gnc">GNC</option>
      </select>
      <select value={filters.transmission ?? ""} onChange={(e) => set("transmission", e.target.value)} style={inputStyle}>
        <option value="">Transmisión</option>
        <option value="manual">Manual</option>
        <option value="automatic">Automático</option>
      </select>
      <select value={filters.condition ?? ""} onChange={(e) => set("condition", e.target.value)} style={inputStyle}>
        <option value="">Condición</option>
        <option value="new">Nuevo</option>
        <option value="used">Usado</option>
      </select>
      <select value={filters.status ?? "available"} onChange={(e) => set("status", e.target.value)} style={inputStyle}>
        <option value="">Todos los estados</option>
        <option value="available">Disponible</option>
        <option value="reserved">Reservado</option>
        <option value="sold">Vendido</option>
      </select>
      <button
        onClick={() => onChange({ page: 1, page_size: 20, status: "available" })}
        style={{ padding: "7px 14px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
      >
        Limpiar
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: 13,
  minWidth: 120,
};
