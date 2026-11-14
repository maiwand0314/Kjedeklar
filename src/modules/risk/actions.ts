"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { fetchAuthMutation } from "@/lib/auth-server";
import { errorCode, errorMessage } from "@/lib/convex-errors";
import type { FormState } from "@/modules/invitations/actions";

const id = z.string().max(64);

/** Kjører screeningen for alle aktive leverandører i perioden, side for side til Convex ikke har flere. */
export async function assessPeriodAction(organizationId: string, reportingPeriodId: unknown): Promise<FormState> {
  const period = id.safeParse(reportingPeriodId);
  if (!period.success) return { status: "error", message: "Velg en rapportperiode først." };
  let assessed = 0;
  let unchanged = 0;
  try {
    let cursor: string | null = null;
    do {
      const page: { assessed: number; unchanged: number; nextCursor: string | null } = await fetchAuthMutation(api.risk.assessments.assessPeriod, {
        organizationId,
        reportingPeriodId: period.data,
        cursor,
      });
      assessed += page.assessed;
      unchanged += page.unchanged;
      cursor = page.nextCursor;
    } while (cursor);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath(`/o/${organizationId}/risikovurderinger`);
  return { status: "ok", message: `Screeningen er kjørt: ${assessed} ny${assessed === 1 ? "" : "e"}, ${unchanged} uendret.` };
}

const reviewValues = z.object({
  supplierId: id,
  reportingPeriodId: id,
  assessmentId: id,
  expectedReviewId: id.nullable(),
  decision: z.enum(["confirm", "override", "revoke"]),
  chosenLevel: z.enum(["low", "moderate", "high"]).optional(),
  rationale: z.string().max(5000),
  evidenceNote: z.string().max(5000).optional(),
});

/** Lagrer kundens bekreftelse, overstyring eller tilbaketrekking. Convex validerer alt på nytt. */
export async function recordReviewAction(organizationId: string, values: unknown): Promise<FormState> {
  const parsed = reviewValues.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Rett feltene som er markert, og prøv igjen." };
  try {
    await fetchAuthMutation(api.risk.reviews.record, { organizationId, ...parsed.data, evidenceNote: parsed.data.evidenceNote || undefined });
  } catch (error) {
    const code = errorCode(error);
    return {
      status: "error",
      message:
        code === "CONFLICT"
          ? "Noen har endret vurderingen, eller screeningen er byttet ut, siden du åpnet siden. Last siden på nytt og se gjennom resultatet. Noter begrunnelsen din først."
          : errorMessage(error),
    };
  }
  revalidatePath(`/o/${organizationId}/risikovurderinger`);
  return { status: "ok", message: "Vurderingen er lagret." };
}
