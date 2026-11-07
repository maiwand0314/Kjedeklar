import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "@/modules/auth/components/login-form";

export default async function LoginPage({ searchParams }: PageProps<"/logg-inn">) {
  const next = safeNextPath((await searchParams).neste);
  if (await isAuthenticated()) redirect(next);
  return (
    <main className="mx-auto w-full max-w-sm px-6 py-24">
      <h1 className="text-2xl font-semibold">Logg inn i Kjedeklar</h1>
      <p className="mt-2 text-zinc-700">Tilgang gis bare etter invitasjon.</p>
      <LoginForm next={next} />
    </main>
  );
}
