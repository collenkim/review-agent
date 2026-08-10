import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { PromptPreview, ReviewContext, ReviewPlan } from "./types";

const PlanSchema = z.object({
  runConvention: z.boolean().describe("컨벤션 검사가 이 diff에 의미 있으면 true"),
  runRequirement: z.boolean().describe("요구사항 검사가 이 diff에 의미 있으면 true (애초에 사용 불가면 false)"),
  runBlastRadius: z.boolean().describe("타 영향(blast-radius) 검사가 이 diff에 의미 있으면 true (애초에 사용 불가면 false)"),
  reasoning: z.string().describe("각 판단 이유를 한국어로 한두 문장씩 간단히"),
});

const SYSTEM_PROMPT =
  "너는 코드 리뷰 파이프라인의 플래너다. diff를 보고 아래 '사용 가능한 검사' 목록 중 " +
  "이 diff에 실제로 의미가 있는 것만 골라 true로 표시한다. " +
  "사용 불가능한 검사는 무조건 false로 한다. " +
  "예: 주석/문서만 바뀐 diff는 blast-radius가 거의 항상 불필요하고, " +
  "함수/클래스 시그니처가 바뀌거나 삭제된 diff는 blast-radius가 필요할 가능성이 높다. " +
  "convention은 코드가 조금이라도 바뀌면 대체로 의미가 있다.";

function buildUserPrompt(context: ReviewContext): string {
  const available = ["convention (항상 사용 가능)"];
  if (context.requirementPath) available.push("requirement (요구사항 문서 있음)");
  if (context.checkBlastRadius) available.push("blast-radius (코드베이스 검색 가능)");

  return (
    `# 사용 가능한 검사\n${available.join("\n")}\n\n` +
    `# diff\n${context.diff}\n\n` +
    "목록에 없는 검사는 애초에 사용 불가능하니 반드시 false로 표시해라."
  );
}

export function previewPlanPrompt(context: ReviewContext): PromptPreview {
  return {
    dimension: "plan",
    reproducible: true,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(context),
  };
}

const client = new Anthropic();

export async function planReview(context: ReviewContext): Promise<ReviewPlan> {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(context) }],
    output_config: { format: zodOutputFormat(PlanSchema) },
  });

  const parsed = response.parsed_output;
  // 파싱 실패 시 안전하게 전부 실행(기존 동작 유지)
  return (
    parsed ?? {
      runConvention: true,
      runRequirement: Boolean(context.requirementPath),
      runBlastRadius: Boolean(context.checkBlastRadius),
      reasoning: "계획 응답 파싱 실패 — 안전하게 요청된 모든 검사를 실행함",
    }
  );
}
