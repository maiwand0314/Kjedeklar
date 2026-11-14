"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assessPeriodAction } from "../actions";

/** Kjører screeningen på nytt for perioden. Uendrede leverandører får ingen ny vurdering. */
export function AssessButton({ organizationId, reportingPeriodId, label }: { organizationId: string; reportingPeriodId: string; label: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const outcome = await assessPeriodAction(organizationId, reportingPeriodId);
              setMessage(outcome.message ? { ok: outcome.status === "ok", text: outcome.message } : null);
              if (outcome.status === "ok") router.refresh();
            })
          }
        >
          {pending ? "Kjører screening …" : label}
        </Button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm" : "text-danger"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
