"use node";

import { randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { siteUrl, smtpConfig } from "./config";
import { sha256Hex, unseal } from "./seal";
import {
  type EmailMessage,
  invitationEmail,
  resetPasswordEmail,
  verifyEmailEmail,
} from "./templates";

/** Sender via SMTP. Logger aldri mottaker, innhold eller lenke. */
async function send(to: string, message: EmailMessage) {
  const config = smtpConfig();
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    ignoreTLS: true, // Bare Mailpit lokalt; produksjon krever TLS (oppgave 25).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  await transport.sendMail({ from: config.from, to, subject: message.subject, text: message.text });
}

/** E-post fra Better Auth (reset/verifisering). Lenken er forseglet i argumentene. */
export const sendAuthEmail = internalAction({
  args: {
    kind: v.union(v.literal("reset"), v.literal("verify")),
    to: v.string(),
    sealedUrl: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, { kind, to, sealedUrl }) => {
    const url = await unseal(sealedUrl);
    await send(to, kind === "reset" ? resetPasswordEmail(url) : verifyEmailEmail(url));
    return null;
  },
});

/**
 * Lager invitasjonstoken (kryptografisk tilfeldig, bare i en action), lagrer
 * hashen og sender lenken. Råtokenet finnes bare i e-posten.
 */
export const sendInvitation = internalAction({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, { invitationId }) => {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = await sha256Hex(token);
    const invitation = await ctx.runMutation(internal.invitations.internal.attachToken, {
      invitationId,
      tokenHash,
    });
    if (!invitation) return null; // Akseptert, tilbakekalt eller utløpt i mellomtiden.
    await send(
      invitation.email,
      invitationEmail({
        organizationName: invitation.organizationName,
        // Fragment (#): tokenet sendes aldri til en server og havner ikke i tilgangslogger.
        url: `${siteUrl()}/invitasjon#token=${token}`,
        expiresAt: invitation.expiresAt,
      }),
    );
    return null;
  },
});
