import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...rest }: Props) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-[10px] border bg-surface px-3 py-2.5 text-sm text-ink placeholder-faint transition-[border-color,box-shadow] duration-150 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15 ${
          error ? "border-red-400" : "border-line"
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className = "", id, children, ...rest }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-muted">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`w-full rounded-[10px] border bg-surface px-3 py-2.5 text-sm text-ink transition-[border-color,box-shadow] duration-150 focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15 ${
          error ? "border-red-400" : "border-line"
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
