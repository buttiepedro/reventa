interface Props {
  score?: number | null;
  avg?: number | null;
  count?: number;
  size?: "sm" | "md";
}

const LIGHTS: Record<number, { icon: string; label: string; color: string }> = {
  2: { icon: "🟢", label: "Verde", color: "text-green-600" },
  1: { icon: "🟡", label: "Amarillo", color: "text-yellow-500" },
  0: { icon: "🔴", label: "Rojo", color: "text-red-500" },
};

export function ReputationBadge({ score, avg, count = 0, size = "sm" }: Props) {
  if (score == null || count < 3) {
    if (size === "md") return <span className="text-xs text-gray-400">Sin calificaciones</span>;
    return null;
  }
  const light = LIGHTS[score];
  if (!light) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${size === "md" ? "text-sm" : "text-xs"} font-semibold ${light.color}`}>
      {light.icon}
      {avg != null && <span>{avg.toFixed(1)}</span>}
      {size === "md" && <span className="text-gray-400 font-normal">({count})</span>}
    </span>
  );
}
