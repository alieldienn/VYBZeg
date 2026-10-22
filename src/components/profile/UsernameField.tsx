"use client";

import { Check, Loader2 } from "lucide-react";
import { TextField } from "@/components/ui/TextField";
import type { UsernameStatus } from "@/lib/hooks/useUsernameCheck";
import { cleanUsernameInput, usernameError } from "@/lib/validation";

type UsernameFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** From useUsernameCheck. */
  status: UsernameStatus;
  /** Error returned by the server when saving (wins over live checks). */
  serverError?: string | null;
};

/** "@username" input with live availability feedback. */
export function UsernameField({ value, onChange, status, serverError }: UsernameFieldProps) {
  const error =
    serverError ??
    (value && status === "invalid" ? usernameError(value) : status === "taken" ? `@${value} is taken. Try another one.` : null);

  const hint =
    status === "checking" ? (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Checking…
      </span>
    ) : status === "available" ? (
      <span className="inline-flex items-center gap-1 text-success">
        <Check className="h-3 w-3" aria-hidden /> @{value} is available
      </span>
    ) : (
      "This is how friends find you."
    );

  return (
    <TextField
      label="Username"
      name="username"
      prefix="@"
      autoComplete="username"
      autoCapitalize="none"
      spellCheck={false}
      required
      value={value}
      onChange={(event) => onChange(cleanUsernameInput(event.target.value))}
      error={error}
      hint={hint}
    />
  );
}
