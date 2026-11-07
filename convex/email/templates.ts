/**
 * Norske e-postmaler. Minimalt innhold: ingen kundedata utover organisasjonsnavn
 * i invitasjoner. Lenken inneholder engangstoken og skal aldri logges.
 */
export type EmailMessage = { subject: string; text: string };

const footer =
  "\n\nHvis du ikke forventet denne e-posten, kan du se bort fra den.\n\nKjedeklar";

export function invitationEmail(input: {
  organizationName: string;
  url: string;
  expiresAt: number;
}): EmailMessage {
  const expires = new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(new Date(input.expiresAt));
  return {
    subject: `Invitasjon til ${input.organizationName} i Kjedeklar`,
    text:
      `Du er invitert som administrator for ${input.organizationName} i Kjedeklar.\n\n` +
      `Åpne lenken for å godta invitasjonen:\n${input.url}\n\n` +
      `Lenken kan brukes én gang og utløper ${expires}.` +
      footer,
  };
}

export function resetPasswordEmail(url: string): EmailMessage {
  return {
    subject: "Tilbakestill passordet ditt i Kjedeklar",
    text:
      "Noen ba om å tilbakestille passordet for denne e-postadressen.\n\n" +
      `Velg nytt passord her:\n${url}\n\n` +
      "Lenken kan brukes én gang og utløper om én time. Når passordet er endret, blir du logget ut overalt." +
      footer,
  };
}

export function verifyEmailEmail(url: string): EmailMessage {
  return {
    subject: "Bekreft e-postadressen din i Kjedeklar",
    text:
      "Bekreft e-postadressen din ved å åpne lenken:\n" +
      `${url}\n\nLenken utløper om én time.` +
      footer,
  };
}
