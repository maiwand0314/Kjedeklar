import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-24">
      <h1 className="text-2xl font-semibold">Ikke funnet</h1>
      <p className="mt-3 text-zinc-700">
        Siden finnes ikke, eller du har ikke tilgang til den.
      </p>
      <Link href="/" className="mt-6 inline-block underline">
        Til forsiden
      </Link>
    </main>
  );
}
