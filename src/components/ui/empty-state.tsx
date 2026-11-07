import type { ReactNode } from "react";

/** Ærlig tomtilstand: sier hva som mangler og hva som kommer, uten eksempeldata. */
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-border bg-surface p-6">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 text-muted">{children}</div>
    </div>
  );
}
