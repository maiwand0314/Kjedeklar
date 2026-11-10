import type { ComponentProps } from "react";

type Props = ComponentProps<"select"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Som Field, men for valg fra en liste. Alternativene gis som <option>-barn. */
export function SelectField({ id, label, hint, error, className = "", ...select }: Props) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="w-full min-w-0 rounded border border-input bg-background px-3 py-2"
        {...select}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
