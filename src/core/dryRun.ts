import { readFileSync } from "fs";
import { previewBlastRadiusPrompt } from "./dimensions/blastRadius";
import { previewConventionPrompt } from "./dimensions/convention";
import { previewRequirementPrompt } from "./dimensions/requirement";
import { previewPlanPrompt } from "./plan";
import type { PromptPreview, ReviewContext } from "./types";
import { previewVerifyPrompt } from "./verify";

/**
 * API를 호출하지 않고, 각 dimension이 실제로 보낼 프롬프트를 조립만 해서 반환한다.
 * claude.ai 등에 수동으로 붙여넣어 확인/튜닝하는 용도.
 */
export function buildDryRunPreviews(context: ReviewContext): PromptPreview[] {
  const previews: PromptPreview[] = [];

  if (context.plan) {
    previews.push(previewPlanPrompt(context));
  }

  const conventionsText = readFileSync(context.conventionsPath, "utf-8");
  previews.push(previewConventionPrompt(context, conventionsText));

  if (context.requirementPath) {
    const requirementText = readFileSync(context.requirementPath, "utf-8");
    previews.push(previewRequirementPrompt(context, requirementText));
  }

  if (context.checkBlastRadius) {
    previews.push(previewBlastRadiusPrompt(context));
  }

  if (context.verify !== false) {
    previews.push(previewVerifyPrompt(context));
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
