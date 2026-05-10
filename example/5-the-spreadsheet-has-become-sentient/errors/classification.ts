import { z } from "zod";
import type { HiggzTaggedError } from "../../../src";

// The final demo lets errors bring instructions with them. Retryable? Severity?
// Please fill out the form, the sentient spreadsheet is watching.
export const ErrorClassificationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("not_found"),
    retryable: z.literal(false),
    severity: z.literal("info")
  }),
  z.object({
    kind: z.literal("transient"),
    retryable: z.literal(true),
    severity: z.literal("warning")
  }),
  z.object({
    kind: z.literal("unavailable"),
    retryable: z.literal(true),
    severity: z.literal("error")
  })
]);

export type ErrorClassification = z.infer<typeof ErrorClassificationSchema>;

// Presets keep the function from becoming a tiny policy factory in a trenchcoat.
export const ErrorClassifications = {
  notFound: {
    kind: "not_found",
    retryable: false,
    severity: "info"
  },
  transient: {
    kind: "transient",
    retryable: true,
    severity: "warning"
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
