import { v } from "convex/values";

/** Offentlig visning av en rapportperiode. Datoer er `YYYY-MM-DD`. */
export const periodSummaryValidator = v.object({
  id: v.id("reportingPeriods"),
  startDate: v.string(),
  endDate: v.string(),
  publicationDueDate: v.string(),
});

/** Ett svar i virksomhetsprofilen: beskrevet, uttrykkelig ikke etablert, eller ikke besvart. */
export const topicAnswerValidator = v.object({
  status: v.union(v.literal("described"), v.literal("not_established"), v.literal("unknown")),
  text: v.string(),
});

/** Temaene i profilen. Samme nøkler som PROFILE_TOPICS i src/domain/reporting/profile.ts. */
export const profileAnswerFields = {
  organizationDescription: topicAnswerValidator,
  operations: topicAnswerValidator,
  countries: topicAnswerValidator,
  responsibility: topicAnswerValidator,
  policies: topicAnswerValidator,
  routines: topicAnswerValidator,
  stakeholderDialogue: topicAnswerValidator,
  remediationProcess: topicAnswerValidator,
};

export const profileAnswersValidator = v.object(profileAnswerFields);
