/**
 * Virksomhetsprofil: kundens egne svar om virksomheten og arbeidet som faktisk
 * er gjort. Hvert tema er enten beskrevet, uttrykkelig «ikke etablert» eller
 * ikke besvart. Et felt i skjemaet betyr aldri at noe finnes hos kunden.
 */
export type AnswerStatus = "described" | "not_established" | "unknown";
export type TopicAnswer = { status: AnswerStatus; text: string };

/**
 * `description`: fakta om virksomheten (beskrevet eller ikke besvart).
 * `practice`: noe virksomheten kan ha eller mangle (også «ikke etablert»).
 */
export const PROFILE_TOPICS = [
  {
    key: "organizationDescription",
    kind: "description",
    label: "Organisering",
    question: "Hvordan er virksomheten organisert?",
    hint: "For eksempel selskapsstruktur, eierskap, avdelinger og omtrentlig antall ansatte.",
  },
  {
    key: "operations",
    kind: "description",
    label: "Drift og produkter",
    question: "Hva driver virksomheten med, og hvilke varer eller tjenester tilbyr den?",
    hint: "",
  },
  {
    key: "countries",
    kind: "description",
    label: "Geografisk virksomhet",
    question: "Hvor har virksomheten egen drift, og hvilke markeder selger den i?",
    hint: "Land og områder med egen drift, produksjon eller salg.",
  },
  {
    key: "responsibility",
    kind: "practice",
    label: "Ansvar",
    question: "Er ansvaret for arbeidet med aktsomhetsvurderinger plassert?",
    hint: "Oppgi rolle eller funksjon, ikke personnavn, og hvordan arbeidet er forankret i styret og ledelsen.",
  },
  {
    key: "policies",
    kind: "practice",
    label: "Retningslinjer",
    question: "Har virksomheten vedtatt retningslinjer for menneskerettigheter og anstendige arbeidsforhold?",
    hint: "Beskriv bare retningslinjer som faktisk er vedtatt.",
  },
  {
    key: "routines",
    kind: "practice",
    label: "Rutiner",
    question: "Har virksomheten rutiner for å kartlegge og håndtere negative konsekvenser?",
    hint: "Beskriv bare rutiner som faktisk er i bruk.",
  },
  {
    key: "stakeholderDialogue",
    kind: "practice",
    label: "Interessentdialog",
    question: "Har virksomheten dialog med berørte interessenter?",
    hint: "For eksempel ansatte, tillitsvalgte, leverandører eller lokalsamfunn.",
  },
  {
    key: "remediationProcess",
    kind: "practice",
    label: "Gjenoppretting",
    question: "Har virksomheten en ordning for klager og for gjenoppretting eller erstatning der det er påkrevd?",
    hint: "",
  },
] as const;

export type TopicKey = (typeof PROFILE_TOPICS)[number]["key"];
export type ProfileAnswers = Record<TopicKey, TopicAnswer>;

export const MAX_ANSWER_LENGTH = 4000;

export const emptyAnswers = (): ProfileAnswers =>
  Object.fromEntries(PROFILE_TOPICS.map((t) => [t.key, { status: "unknown", text: "" }])) as ProfileAnswers;

/**
 * Trimmet og kontrollert kopi, eller `null` når svarene er ugyldige: «beskrevet»
 * krever tekst, «ikke etablert» finnes bare for praksistemaer, og andre svar
 * enn «beskrevet» lagres uten tekst (så en gammel tekst ikke blir hengende).
 */
export function normalizeAnswers(answers: ProfileAnswers): ProfileAnswers | null {
  const result = emptyAnswers();
  for (const topic of PROFILE_TOPICS) {
    const { status, text } = answers[topic.key];
    const trimmed = text.trim();
    if (status === "described") {
      if (trimmed.length === 0 || trimmed.length > MAX_ANSWER_LENGTH) return null;
      result[topic.key] = { status, text: trimmed };
    } else {
      if (status === "not_established" && topic.kind !== "practice") return null;
      result[topic.key] = { status, text: "" };
    }
  }
  return result;
}

/** Temaene som ikke er besvart. Uten lagret profil er alt ubesvart. */
export function profileGaps(answers: ProfileAnswers | null): TopicKey[] {
  return PROFILE_TOPICS.filter((t) => !answers || answers[t.key].status === "unknown").map((t) => t.key);
}
