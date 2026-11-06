"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    const { error: signOutError } = await authClient.signOut();
    if (signOutError) {
      setPending(false);
      setError("Utlogging feilet. Prøv igjen.");
      return;
    }
    router.replace("/logg-inn");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded border border-zinc-400 px-3 py-1.5 font-medium disabled:opacity-60"
      >
        {pending ? "Logger ut …" : "Logg ut"}
      </button>
    </div>
  );
}
