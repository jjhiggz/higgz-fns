import { z } from "zod";
import type { HiggzTaggedError } from "../../../src";

// Error data can carry policy, not just vibes. Here we teach the app whether a
// failure is retryable and how noisy it should be.
export const ErrorClassificationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("not_found"),
    retryable: z.literal(false),
    severity: z.literal("info")
  }),
  z.object({
    kind: z.literal("unavailable"),
    retryable: z.literal(true),
    severity: z.literal("error")
  })
]);

export type ErrorClassification = z.infer<typeof ErrorClassificationSchema>;

// Tiny named presets keep the function body readable. Future-you says thanks.
export const ErrorClassifications = {
  notFound: {
    kind: "not_found",
    retryable: false,
    severity: "info"
  },
  unavailable: {
    kind: "unavailable",
    retryable: true,
    severity: "error"
  }
} as const satisfies Record<string, ErrorClassification>;

export function isRetryableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as HiggzTaggedError<string, { classification?: unknown }>).data
      .classification === "object" &&
    (error as HiggzTaggedError<string, { classification: ErrorClassification }>)
      .data.classification.retryable
  );
}
