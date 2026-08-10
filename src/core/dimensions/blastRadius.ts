import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { withPolicy } from "../policy";
import type { DimensionResult, PromptPreview, ReviewContext } from "../types";
import { createSearchCodebaseTool } from "../tools/searchCodebase";

const FindingsSchema = z.object({
  findings: z.array(
    z.object({
      file: z.string().optional().describe("영향을 받는 것으로 보이는 파일"),
      line: z.number().optional(),
      summary: z
        .string()
        .describe(
          "diff의 변경이 다른 코드에 어떤 영향을 줄 수 있는지, search_codebase로 확인한 근거와 함께 한국어로 설명",
        ),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
});

const SYSTEM_PROMPT =
  "너는 코드 리뷰어다. 아래 diff에서 변경되거나 삭제된 함수/클래스/메서드 시그니처가 " +
  "diff 밖의 다른 곳에서도 호출·참조되는지 search_codebase 도구로 확인한다. " +
  "diff가 그 호출부를 함께 수정하지 않은 경우만 문제로 지적한다. " +
  "확실하지 않으면 지적하지 말고 근거 없는 추측은 하지 않는다. " +
  "확인이 끝나면 findings로만 응답한다.";

function buildUserPrompt(context: ReviewContext): string {
  return withPolicy(`# diff\n${context.diff}`, context.policyText);
}

export function previewBlastRadiusPrompt(context: ReviewContext): PromptPreview {
  return {
    dimension: "blast-radius",
    reproducible: false,
    note:
      "search_codebase 도구를 여러 번 호출하며 진행되는 다중 턴 대화라, " +
      "이 프롬프트는 첫 턴만 재현한다. 실제 결과는 모델이 도구를 몇 번 어떻게 " +
      "호출하느냐에 따라 달라져 claude.ai 채팅만으로는 완전히 재현할 수 없다. " +
      "제공되는 도구: search_codebase(query: string) — 저장소를 git grep -F로 검색.",
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(context),
  };
}

const client = new Anthropic();

export async function reviewBlastRadius(
  context: ReviewContext,
): Promise<DimensionResult> {
  const repoRoot = context.repoRoot ?? process.cwd();
  const searchCodebase = createSearchCodebaseTool(repoRoot);

  const runner = client.beta.messages.toolRunner({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [searchCodebase],
    output_config: { format: zodOutputFormat(FindingsSchema) },
    messages: [{ role: "user", content: buildUserPrompt(context) }],
  });

  let finalMessage: Anthropic.Beta.Messages.BetaMessage | undefined;
  for await (const message of runner) {
    finalMessage = message;
  }

  let text = "";
  for (const block of finalMessage?.content ?? []) {
    if (block.type === "text") {
      text += block.text;
    }
  }

  const parsed = text ? FindingsSchema.parse(JSON.parse(text)) : { findings: [] };
  return { dimension: "blast-radius", findings: parsed.findings };
}
