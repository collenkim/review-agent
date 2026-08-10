import { readFileSync } from "fs";

import { reviewBlastRadius } from "./dimensions/blastRadius";
import { reviewConvention } from "./dimensions/convention";
import { reviewRequirement } from "./dimensions/requirement";
import { reviewTestCoverage } from "./dimensions/testCoverage";
import { planReview } from "./plan";
import type { DimensionResult, ReviewContext, ReviewOutcome, ReviewPlan } from "./types";
import { verifyResults } from "./verify";

/**
 * 요구사항 원문을 구한다. 파일(requirementPath)보다 직접 넘긴 텍스트(requirementText)를
 * 우선하는 이유는, 후자가 PR 본문처럼 파일로 존재하지 않는 더 구체적인 출처이기 때문.
 */
export function resolveRequirementText(context: ReviewContext): string | undefined {
  if (context.requirementText?.trim()) {
    return context.requirementText;
  }
  if (context.requirementPath) {
    return readFileSync(context.requirementPath, "utf-8");
  }
  return undefined;
}

/** policyPath를 읽어 policyText가 채워진 context를 돌려준다. */
export function withResolvedPolicy(context: ReviewContext): ReviewContext {
  if (!context.policyPath) {
    return context;
  }
  return { ...context, policyText: readFileSync(context.policyPath, "utf-8") };
}

export async function runReview(context: ReviewContext): Promise<ReviewOutcome> {
  const resolved = withResolvedPolicy(context);

  let plan: ReviewPlan | undefined;
  let effectiveContext = resolved;

  if (resolved.plan) {
    plan = await planReview(resolved);
    // plan은 사용자가 이미 켠 것을 끄는 역할만 함 — 상한선은 항상 원래 context
    effectiveContext = {
      ...resolved,
      requirementPath: plan.runRequirement ? resolved.requirementPath : undefined,
      requirementText: plan.runRequirement ? resolved.requirementText : undefined,
      checkBlastRadius: Boolean(resolved.checkBlastRadius && plan.runBlastRadius),
      checkTestCoverage: Boolean(resolved.checkTestCoverage && plan.runTestCoverage),
    };
  }

  const conventionsText = readFileSync(effectiveContext.conventionsPath, "utf-8");

  const tasks: Promise<DimensionResult>[] = [];

  if (!plan || plan.runConvention) {
    tasks.push(reviewConvention(effectiveContext, conventionsText));
  }

  const requirementText = resolveRequirementText(effectiveContext);
  if (requirementText) {
    tasks.push(reviewRequirement(effectiveContext, requirementText));
  }

  if (effectiveContext.checkBlastRadius) {
    tasks.push(reviewBlastRadius(effectiveContext));
  }

  if (effectiveContext.checkTestCoverage) {
    tasks.push(reviewTestCoverage(effectiveContext));
  }

  const dimensionResults = await Promise.all(tasks);

  const results =
    effectiveContext.verify === false
      ? dimensionResults
      : await verifyResults(dimensionResults, effectiveContext);

  return { results, plan };
}

export type { DimensionResult, Finding, ReviewContext, ReviewOutcome, ReviewPlan } from "./types";
