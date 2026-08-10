import { readFileSync } from "fs";
import { reviewBlastRadius } from "./dimensions/blastRadius";
import { reviewConvention } from "./dimensions/convention";
import { reviewRequirement } from "./dimensions/requirement";
import type { DimensionResult, ReviewContext } from "./types";

export async function runReview(
  context: ReviewContext,
): Promise<DimensionResult[]> {
  const conventionsText = readFileSync(context.conventionsPath, "utf-8");

  const tasks: Promise<DimensionResult>[] = [
    reviewConvention(context, conventionsText),
  ];

  if (context.requirementPath) {
    const requirementText = readFileSync(context.requirementPath, "utf-8");
    tasks.push(reviewRequirement(context, requirementText));
  }

  if (context.checkBlastRadius) {
    tasks.push(reviewBlastRadius(context));
  }

  return Promise.all(tasks);
}

export type { DimensionResult, Finding, ReviewContext } from "./types";
