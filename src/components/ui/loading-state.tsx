/**
 * Lastetilstand for loading.tsx. Ligger under layouter som validerer (f.eks.
 * [section]/layout.tsx), så notFound() der skjer før strømmingen og gir ekte 404.
 */
export function LoadingState() {
  return (
    <p role="status" aria-live="polite" className="text-muted">
      Laster …
    </p>
  );
}
