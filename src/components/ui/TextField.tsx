"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label: string;
  /** Shown in red under the field. */
  error?: string | null;
  /** Shown in grey under the field when there's no error. */
  hint?: ReactNode;
  /** Text inside the box before the value, e.g. "@". */
  prefix?: string;
  /** Something on the right of the label, e.g. a character count. */
  aside?: ReactNode;
};

/** A labelled input in the VYBZ style, with error and hint text. */
export function TextField({ label, error, hint, prefix, aside, className, id, type, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-2 flex items-center justify-between text-sm font-medium">
        {label}
        {aside}
      </label>
      <span
        className={cn(
          "flex items-center rounded-2xl border bg-elevated px-4 transition-colors focus-within:border-brand/60",
          error ? "border-danger/60" : "border-line",
        )}
      >
        {prefix && <span className="mr-0.5 text-subtle">{prefix}</span>}
        <input
          id={inputId}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? messageId : undefined}
          className="h-12 w-full min-w-0 bg-transparent text-[15px] placeholder:text-subtle focus:outline-none"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="-mr-2 rounded-full p-2 text-subtle transition hover:text-fg"
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </span>
      {error ? (
        <span id={messageId} className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="mt-1.5 block text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Red banner for errors that aren't about one field. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}
