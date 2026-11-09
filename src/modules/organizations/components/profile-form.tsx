"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/textarea-field";
import { MAX_ANSWER_LENGTH, PROFILE_TOPICS, type AnswerStatus, type ProfileAnswers, type TopicKey } from "@/domain/reporting/profile";
import { saveBusinessProfileAction } from "../actions";

const CHOICES: Array<[AnswerStatus, string]> = [
  ["described", "Ja"],
  ["not_established", "Nei, ikke etablert"],
  ["unknown", "Ikke besvart"],
];

/**
 * Skjema for virksomhetsprofilen i én rapportperiode. Hver lagring blir en ny
 * versjon. `revision` er versjonen skjemaet bygger på; har noen andre lagret i
 * mellomtiden, avviser Convex lagringen.
 */
export function ProfileForm({
  organizationId,
  periodId,
  initial,
  initialRevision,
}: {
  organizationId: string;
  periodId: string;
  initial: ProfileAnswers;
  initialRevision: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initial);
  const [revision, setRevision] = useState(initialRevision);
  const [confirmed, setConfirmed] = useState(false);
  const [missing, setMissing] = useState<TopicKey[]>([]);
  const [message, setMessage] = useState<{ status: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (key: TopicKey, status: AnswerStatus, text: string) => setAnswers((a) => ({ ...a, [key]: { status, text } }));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const empty = PROFILE_TOPICS.filter((t) => answers[t.key].status === "described" && !answers[t.key].text.trim()).map((t) => t.key);
    setMissing(empty);
    setMessage(null);
    if (empty.length > 0) return;
    startTransition(async () => {
      const outcome = await saveBusinessProfileAction(organizationId, {
        reportingPeriodId: periodId,
        answers,
        confirmed,
        expectedRevision: revision,
      });
      setMessage({ status: outcome.status === "ok" ? "ok" : "error", text: outcome.message ?? "" });
      if (outcome.status === "ok" && outcome.revision) {
        setRevision(outcome.revision);
        setConfirmed(false);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {PROFILE_TOPICS.map((topic) => {
        const answer = answers[topic.key];
        const error = missing.includes(topic.key) ? "Skriv en beskrivelse, eller velg et annet svar." : undefined;
        if (topic.kind === "description") {
          return (
            <TextAreaField
              key={topic.key}
              id={`profile-${topic.key}`}
              label={topic.question}
              hint={[topic.hint, "La feltet stå tomt hvis det ikke er avklart."].filter(Boolean).join(" ")}
              maxLength={MAX_ANSWER_LENGTH}
              value={answer.text}
              onChange={(e) => set(topic.key, e.target.value.trim() ? "described" : "unknown", e.target.value)}
            />
          );
        }
        return (
          <fieldset key={topic.key} className="flex flex-col gap-2">
            <legend className="font-medium">{topic.question}</legend>
            <div className="flex flex-wrap gap-4">
              {CHOICES.map(([status, label]) => (
                <label key={status} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={topic.key}
                    value={status}
                    checked={answer.status === status}
                    onChange={() => set(topic.key, status, answer.text)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {answer.status === "described" && (
              <TextAreaField
                id={`profile-${topic.key}`}
                label={`Beskrivelse: ${topic.label.toLowerCase()}`}
                hint={topic.hint || undefined}
                maxLength={MAX_ANSWER_LENGTH}
                value={answer.text}
                onChange={(e) => set(topic.key, "described", e.target.value)}
                error={error}
              />
            )}
          </fieldset>
        );
      })}
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
        <span>
          Jeg bekrefter at svarene beskriver virksomheten slik den faktisk er nå. Valgfritt: du kan lagre uten å bekrefte
          og fortsette senere. Bekreftelsen er intern og ingen underskrift.
        </span>
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Lagrer …" : "Lagre profilen"}
        </Button>
      </div>
      {message && (
        <p role={message.status === "error" ? "alert" : "status"} className={message.status === "error" ? "text-danger" : ""}>
          {message.text}
        </p>
      )}
    </form>
  );
}
