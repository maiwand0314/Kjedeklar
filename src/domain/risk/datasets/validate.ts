/**
 * Semantisk validering av en manifestfil utover formen (Zod): duplikater,
 * tvetydig bransjemapping, ugyldige datoer og metodens interne konsistens.
 * Returnerer alle feil, ikke bare den første, så en kilde kan rettes i én runde.
 *
 * Bransjemapping: `codeExact` har prioritet foran `codePrefix`, og lengste
 * prefiks vinner. Overlappende prefikser av ulik lengde er altså lovlige og
 * løst; to linjer med samme nøkkel er tvetydige og avvises.
 */
import { manifestSchema, isDatasetCountry, type RiskManifest } from "./schema.ts";

export type ValidationResult = { ok: true; manifest: RiskManifest } | { ok: false; errors: string[] };

export function validateManifest(raw: unknown): ValidationResult {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(rot)"}: ${i.message}`) };
  }
  const manifest = parsed.data;
  const errors: string[] = [];

  const review = manifest.review;
  if (review && review.reviewDueAt <= review.reviewedAt) errors.push("review.reviewDueAt må ligge etter review.reviewedAt");
  if (review && manifest.approval && manifest.approval.approvedAt < review.reviewedAt) errors.push("approval.approvedAt kan ikke ligge før review.reviewedAt");
  if (manifest.approval && !review) errors.push("approval krever review");
  if (manifest.kind !== "method" && manifest.retrievedAt > (review?.reviewedAt ?? manifest.retrievedAt)) {
    errors.push("retrievedAt kan ikke ligge etter review.reviewedAt");
  }

  if (manifest.kind === "country") {
    const seen = new Set<string>();
    manifest.entries.forEach((e, i) => {
      if (!isDatasetCountry(e.iso2, manifest.environment)) errors.push(`entries.${i}.iso2: ${e.iso2} er ikke en gyldig landkode`);
      if (seen.has(e.iso2)) errors.push(`entries.${i}.iso2: ${e.iso2} finnes flere ganger`);
      seen.add(e.iso2);
    });
  }

  if (manifest.kind === "industry") {
    const seen = new Set<string>();
    manifest.entries.forEach((e, i) => {
      const key = e.codeExact ? `exact:${e.codeExact}` : e.codePrefix ? `prefix:${e.codePrefix}` : `product:${e.productCategory}`;
      if (seen.has(key)) errors.push(`entries.${i}: tvetydig mapping, ${key} finnes flere ganger`);
      seen.add(key);
    });
  }

  if (manifest.kind === "method") {
    const { definition } = manifest;
    const ids = new Set<string>();
    definition.ruleDefinitions.forEach((r, i) => {
      if (ids.has(r.ruleId)) errors.push(`definition.ruleDefinitions.${i}.ruleId: ${r.ruleId} finnes flere ganger`);
      ids.add(r.ruleId);
      if (r.kind === "control_signal" && (r.factor === "country" || r.factor === "industry" || r.factor === "product")) {
        errors.push(`definition.ruleDefinitions.${i}: kontrollsignal kan ikke bruke faktoren ${r.factor}; land, bransje og produkt er risikofaktorer`);
      }
    });
    const order = definition.priorityOrder;
    if (new Set(order).size !== 4) errors.push("definition.priorityOrder må inneholde high, moderate, low og unknown nøyaktig én gang");
    else if (order.indexOf("unknown") > order.indexOf("low")) errors.push("definition.priorityOrder: unknown må komme før low, så ukjent aldri faller bak lav risiko");
    if (order[0] !== "high") errors.push("definition.priorityOrder: high må komme først");
  }

  return errors.length ? { ok: false, errors } : { ok: true, manifest };
}
