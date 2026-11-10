"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setSupplierArchivedAction } from "../actions";

/** Arkiverer eller gjenoppretter leverandøren. Ingenting slettes. */
export function ArchiveButton({
  organizationId,
  supplierId,
  rowVersion,
  archived,
}: {
  organizationId: string;
  supplierId: string;
  rowVersion: number;
  archived: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const outcome = await setSupplierArchivedAction(organizationId, {
                supplierId,
                expectedRowVersion: rowVersion,
                archived: !archived,
              });
              setError(outcome.status === "error" ? (outcome.message ?? "Noe gikk galt. Prøv igjen.") : null);
              if (outcome.status === "ok") router.refresh();
            })
          }
        >
          {archived ? "Gjenopprett leverandøren" : "Arkiver leverandøren"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
