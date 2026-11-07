"use client";

import { Button } from "@/components/ui/button";

/** Uventet feil i en side. Viser ingen tekniske detaljer; feil-id (digest) hjelper feilsøking. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert">
      <h1 className="text-2xl font-semibold">Noe gikk galt</h1>
      <p className="mt-2 text-muted">
        Siden kunne ikke vises. Prøv igjen, eller kontakt oss hvis feilen vedvarer.
        {error.digest && <> Feil-id: {error.digest}</>}
      </p>
      <Button className="mt-6" onClick={reset}>
        Prøv igjen
      </Button>
    </div>
  );
}
