"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { takeFragmentToken } from "@/lib/fragment-token";
import { verifyEmailAction } from "@/modules/invitations/actions";

export function VerifyEmail() {
  const [token] = useState(takeFragmentToken);
  const [state, setState] = useState<"pending" | "ok" | "invalid">(token ? "pending" : "invalid");
  useEffect(() => {
    if (!token) return;
    void verifyEmailAction(token).then((ok) => setState(ok ? "ok" : "invalid"));
  }, [token]);

  if (state === "pending") return <p className="mt-6">Bekrefter …</p>;
  return (
    <div className="mt-6">
      <p role={state === "ok" ? "status" : "alert"}>
        {state === "ok"
          ? "E-postadressen er bekreftet. Du kan nå logge inn."
          : "Lenken er ugyldig eller utløpt. Logg inn for å få en ny."}
      </p>
      <Link href="/logg-inn" className="mt-4 inline-block underline">
        Til innlogging
      </Link>
    </div>
  );
}
