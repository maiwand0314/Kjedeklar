"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Meny basert på <details> (tastaturvennlig uten ekstra skript), som i tillegg
 * lukkes med Escape (fokus tilbake til knappen) og ved klikk utenfor.
 */
export function Disclosure({
  summary,
  summaryClassName,
  className,
  children,
}: {
  summary: ReactNode;
  summaryClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = ref.current;
      if (e.key !== "Escape" || !el?.open) return;
      el.open = false;
      el.querySelector("summary")?.focus();
    }
    function onClick(e: MouseEvent) {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return (
    <details ref={ref} className={className}>
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}
