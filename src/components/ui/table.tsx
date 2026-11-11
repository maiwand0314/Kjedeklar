import type { ReactNode } from "react";

/** Tabell med felles stil. Rulles vannrett på smale skjermer i stedet for å presse kolonnene. */
export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    // @container: innhold kan måle seg mot det synlige området (cqw), f.eks. linjer som ikke skal rulle med kolonnene.
    <div className="@container overflow-x-auto">
      <table className="w-full text-left text-sm [&_td]:py-2 [&_td]:pr-4 [&_th]:py-2 [&_th]:pr-4 [&_th]:font-medium [&_tr]:border-b [&_tr]:border-border">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
