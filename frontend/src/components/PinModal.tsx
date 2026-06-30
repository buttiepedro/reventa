import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  subtitle?: string;
  onSubmit: (pin: string) => boolean;
  onCancel: () => void;
  error?: string;
}

export function PinModal({ title, subtitle, onSubmit, onCancel }: Props) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [shake, setShake] = useState(false);
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    refs[0].current?.focus();
  }, []);

  const handleChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 3) refs[i + 1].current?.focus();
    if (next.every((d) => d !== "") && val) {
      const pin = next.join("");
      const ok = onSubmit(pin);
      if (!ok) {
        setShake(true);
        setDigits(["", "", "", ""]);
        setTimeout(() => { setShake(false); refs[0].current?.focus(); }, 500);
      }
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i - 1].current?.focus();
    }
    if (e.key === "Escape") onCancel();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onCancel} />
      <div className="fixed inset-x-4 top-1/3 -translate-y-1/2 mx-auto max-w-xs bg-white rounded-2xl shadow-2xl z-50 p-6 text-center">
        <div className="text-3xl mb-3">🔒</div>
        <h2 className="text-base font-bold text-gray-900 mb-1">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mb-5">{subtitle}</p>}
        <div className={`flex justify-center gap-3 mb-4 ${shake ? "animate-shake" : ""}`}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none"
            />
          ))}
        </div>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">
          Cancelar
        </button>
      </div>
    </>
  );
}
