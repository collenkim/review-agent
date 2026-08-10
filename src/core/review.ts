import { readFileSync } from "fs";
import { reviewConvention } from "./dimensions/convention";
import type { DimensionResult, ReviewContext } from "./types";

export async function runReview(
  context: ReviewContext,
): Promise<DimensionResult[]> {
  const conventionsText = readFileSync(context.conventionsPath, "utf-8");
  const results = await Promise.all([
    reviewConvention(context, conventionsText),
  ]);
  return results;
}

export type { DimensionResult, Finding, ReviewContext } from "./types";
