type Tone = "green" | "red" | "yellow" | "blue" | "gray" | "purple";

const tones: Record<Tone, string> = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  yellow: "bg-yellow-100 text-yellow-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-gray-100 text-gray-700",
  purple: "bg-purple-100 text-purple-800",
};

interface Props {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone = "gray", children, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
