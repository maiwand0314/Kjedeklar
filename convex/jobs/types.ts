/** Typer for jobbhandlere. Egen fil uten avhengighet til registeret, så handlerne kan importere dem uten sirkel. */
import type { z } from "zod";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { TenantTable } from "../lib/tenant";

/** Det handleren får: tenant og referanse fra den lagrede jobben, aldri fra klienten. */
export type JobInput = { organizationId: Id<"organizations">; inputRef: string; attempt: number };

export type JobHandler<Output = unknown> = {
  /** Tabellen `inputRef` peker inn i. Kontrolleres med getOwned ved opprettelse, start og resultat. */
  table: TenantTable;
  /** Forsøk og ventetid. Etter `maxAttempts` får jobben sluttstatus «failed». */
  retry: { maxAttempts: number; initialBackoffMs: number; base: number };
  /** Finnes bare i lokale testmiljø. */
  testOnly?: boolean;
  /** Arbeidet. Kjører i en action og kan gjøre eksterne kall. Kan kjøre flere ganger. */
  run: (ctx: ActionCtx, job: JobInput) => Promise<unknown>;
  /** Formen på det `run` returnerer. Valideres før noe skrives. */
  output: z.ZodType<Output>;
  /** Skriver resultatet, i samme mutasjon som setter jobben til fullført. Kalles høyst én gang per jobb. */
  apply?: (ctx: MutationCtx, job: Doc<"jobs">, output: Output) => Promise<void>;
};

/**
 * En feil handleren selv kjenner igjen. `code` lagres på jobben og i
 * revisjonsloggen, så den skal være en kort kode uten innhold fra kunden.
 * `retryable: false` gir sluttstatus med en gang.
 */
export class JobError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = true,
  ) {
    super(code);
  }
}
