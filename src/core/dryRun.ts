import { readFileSync } from "fs";

import { previewBlastRadiusPrompt } from "./dimensions/blastRadius";
import { previewConventionPrompt } from "./dimensions/convention";
import { previewRequirementPrompt } from "./dimensions/requirement";
import { previewTestCoveragePrompt } from "./dimensions/testCoverage";
import { previewPlanPrompt } from "./plan";
import { resolveRequirementText, withResolvedPolicy } from "./review";
import type { PromptPreview, ReviewContext } from "./types";
import { previewVerifyPrompt } from "./verify";

/**
 * API를 호출하지 않고, 각 dimension이 실제로 보낼 프롬프트를 조립만 해서 반환한다.
 * claude.ai 등에 수동으로 붙여넣어 확인/튜닝하는 용도.
 */
export function buildDryRunPreviews(context: ReviewContext): PromptPreview[] {
  const resolved = withResolvedPolicy(context);
  const previews: PromptPreview[] = [];

  if (resolved.plan) {
    previews.push(previewPlanPrompt(resolved));
  }

  const conventionsText = readFileSync(resolved.conventionsPath, "utf-8");
  previews.push(previewConventionPrompt(resolved, conventionsText));

  const requirementText = resolveRequirementText(resolved);
  if (requirementText) {
    previews.push(previewRequirementPrompt(resolved, requirementText));
  }

  if (resolved.checkBlastRadius) {
    previews.push(previewBlastRadiusPrompt(resolved));
  }

  if (resolved.checkTestCoverage) {
    previews.push(previewTestCoveragePrompt(resolved));
  }

  if (resolved.verify !== false) {
    previews.push(previewVerifyPrompt(resolved));
  }

  return previews;
}

export function formatDryRunReport(previews: PromptPreview[]): string {
  return previews
    .map((preview) => {
      const header = `${"=".repeat(60)}\n[${preview.dimension}]${
        preview.reproducible ? "" : " (참고용 — 실제 대화를 완전히 재현하지 않음)"
      }\n${"=".repeat(60)}`;
      const note = preview.note ? `\n[note] ${preview.note}\n` : "";
      return (
        `${header}${note}\n` +
        `--- system ---\n${preview.system}\n\n` +
        `--- user ---\n${preview.user}\n`
      );
    })
    .join("\n\n");
}
