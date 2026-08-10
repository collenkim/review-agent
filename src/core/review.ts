import { readFileSync } from "fs";
import { reviewBlastRadius } from "./dimensions/blastRadius";
import { reviewConvention } from "./dimensions/convention";
import { reviewRequirement } from "./dimensions/requirement";
import { planReview } from "./plan";
import type { DimensionResult, ReviewContext, ReviewOutcome, ReviewPlan } from "./types";
import { verifyResults } from "./verify";

export async function runReview(context: ReviewContext): Promise<ReviewOutcome> {
  let plan: ReviewPlan | undefined;
  let effectiveContext = context;

  if (context.plan) {
    plan = await planReview(context);
    // plan은 사용자가 이미 켠 것을 끄는 역할만 함 — 상한선은 항상 원래 context
    effectiveContext = {
      ...context,
      requirementPath:
        context.requirementPath && plan.runRequirement ? context.requirementPath : undefined,
      checkBlastRadius: Boolean(context.checkBlastRadius && plan.runBlastRadius),
    };
  }

  const conventionsText = readFileSync(effectiveContext.conventionsPath, "utf-8");

  const tasks: Promise<DimensionResult>[] = [];

  if (!plan || plan.runConvention) {
    tasks.push(reviewConvention(effectiveContext, conventionsText));
  }

  if (effectiveContext.requirementPath) {
    const requirementText = readFileSync(effectiveContext.requirementPath, "utf-8");
    tasks.push(reviewRequirement(effectiveContext, requirementText));
  }

  if (effectiveContext.checkBlastRadius) {
    tasks.push(reviewBlastRadius(effectiveContext));
  }

  const dimensionResults = await Promise.all(tasks);

  const results =
    effectiveContext.verify === false
      ? dimensionResults
      : await verifyResults(dimensionResults, effectiveContext);

  return { results, plan };
}

export type { DimensionResult, Finding, ReviewContext, ReviewOutcome, ReviewPlan } from "./types";
