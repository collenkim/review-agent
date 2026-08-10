import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { withPolicy } from "../policy";
import type { DimensionResult, PromptPreview, ReviewContext } from "../types";

const FindingsSchema = z.object({
  findings: z.array(
    z.object({
      file: z
        .string()
        .optional()
        .describe("테스트가 필요한데 없는 대상 파일. 특정하기 어려우면 생략"),
      line: z.number().optional(),
      summary: z
        .string()
        .describe("어떤 동작이 테스트되지 않았고 왜 테스트가 필요한지 한국어로 설명"),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
});

const SYSTEM_PROMPT =
  "너는 코드 리뷰어다. diff에 추가·변경된 동작 중 테스트가 동반되지 않은 것만 찾는다. " +
  "테스트 코드 자체의 품질이나 컨벤션, 로직 버그는 다루지 않는다. " +
  "diff 안에 해당 동작을 검증하는 테스트가 함께 있으면 지적하지 않는다. " +
  "설정 변경·문서·단순 리네임처럼 테스트할 동작이 없는 변경은 지적하지 않는다. " +
  "diff 밖에 이미 테스트가 있을 가능성이 있으면 추측하지 말고 지적하지 않는다. " +
  "테스트가 필요한 누락이 없으면 빈 배열을 반환한다.";

function buildUserPrompt(context: ReviewContext): string {
  return withPolicy(`# 리뷰할 diff\n${context.diff}`, context.policyText);
}

export function previewTestCoveragePrompt(context: ReviewContext): PromptPreview {
  return {
    dimension: "test-coverage",
    reproducible: true,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(context),
  };
}

const client = new Anthropic();

export async function reviewTestCoverage(
  context: ReviewContext,
): Promise<DimensionResult> {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(context) }],
    output_config: { format: zodOutputFormat(FindingsSchema) },
  });

  const parsed = response.parsed_output;
  return { dimension: "test-coverage", findings: parsed?.findings ?? [] };
}
