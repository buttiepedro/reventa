type Tone = "green" | "red" | "yellow" | "blue" | "gray" | "purple";

const tones: Record<Tone, string> = {
  green: "bg-mint text-brand",
  red: "bg-red-50 text-red-600",
  yellow: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  gray: "bg-tab text-muted",
  purple: "bg-purple-50 text-purple-700",
};

interface Props {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone = "gray", children, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
