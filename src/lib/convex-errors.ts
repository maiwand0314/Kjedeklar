import { ConvexError } from "convex/values";

export function errorCode(error: unknown): string | undefined {
  if (error instanceof ConvexError) {
    const data = error.data as { code?: unknown } | undefined;
    return typeof data?.code === "string" ? data.code : undefined;
  }
  return undefined;
}
