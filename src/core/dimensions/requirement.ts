import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DimensionResult, PromptPreview, ReviewContext } from "../types";

const FindingsSchema = z.object({
  findings: z.array(
    z.object({
      file: z
        .string()
        .optional()
        .describe("관련된 파일이 명확할 때만 지정, 요구사항 전체에 대한 지적이면 생략"),
      line: z.number().optional(),
      summary: z.string().describe("요구사항의 어떤 부분이 왜 충족되지 않았는지 한국어로 설명"),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
});

const SYSTEM_PROMPT =
  "너는 코드 리뷰어다. 아래 요구사항을 diff가 실제로 충족하는지만 판단한다. " +
  "요구사항에 없는 범위의 코드 품질/컨벤션/버그는 다루지 않는다. " +
  "요구사항이 diff 범위를 벗어나 판단 불가능한 항목은 언급하지 말고, " +
  "diff로 확인 가능한 범위 내에서 빠졌거나 다르게 구현된 부분만 지적한다. " +
  "모두 충족되면 빈 배열을 반환한다.";

function buildUserPrompt(context: ReviewContext, requirementText: string): string {
  return `# 요구사항\n${requirementText}\n\n# 구현된 diff\n${context.diff}`;
}

export function previewRequirementPrompt(
  context: ReviewContext,
  requirementText: string,
): PromptPreview {
  return {
    dimension: "requirement",
    reproducible: true,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(context, requirementText),
  };
}

const client = new Anthropic();

export async function reviewRequirement(
  context: ReviewContext,
  requirementText: string,
): Promise<DimensionResult> {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(context, requirementText) }],
    output_config: { format: zodOutputFormat(FindingsSchema) },
  });

  const parsed = response.parsed_output;
  return { dimension: "requirement", findings: parsed?.findings ?? [] };
}
