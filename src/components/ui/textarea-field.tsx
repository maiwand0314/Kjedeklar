import type { ComponentProps } from "react";

type Props = ComponentProps<"textarea"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Som Field, men for flere linjer tekst. */
export function TextAreaField({ id, label, hint, error, className = "", ...textarea }: Props) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="rounded border border-input bg-background px-3 py-2"
        {...textarea}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
