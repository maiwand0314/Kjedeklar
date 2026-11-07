"use client";

import dynamic from "next/dynamic";

/**
 * Komponenter som leser token fra URL-fragmentet, finnes bare i nettleseren.
 * De rendres derfor bare på klienten (fragmentet når aldri serveren).
 */
const loading = () => <p className="mt-6">Laster …</p>;

export const InvitationFlowClient = dynamic(
  () => import("@/modules/invitations/components/invitation-flow").then((m) => m.InvitationFlow),
  { ssr: false, loading },
);

export const VerifyEmailClient = dynamic(
  () => import("./verify-email").then((m) => m.VerifyEmail),
  { ssr: false, loading },
);

export const ResetPasswordFromLinkClient = dynamic(
  () => import("./reset-password-form").then((m) => m.ResetPasswordFromLink),
  { ssr: false, loading },
);
