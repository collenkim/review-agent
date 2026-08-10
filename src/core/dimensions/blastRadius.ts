import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DimensionResult, ReviewContext } from "../types";
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

const client = new Anthropic();

export async function reviewBlastRadius(
  context: ReviewContext,
): Promise<DimensionResult> {
  const repoRoot = context.repoRoot ?? process.cwd();
  const searchCodebase = createSearchCodebaseTool(repoRoot);

  const runner = client.beta.messages.toolRunner({
    model: "claude-opus-5",
    max_tokens: 8000,
    system:
      "너는 코드 리뷰어다. 아래 diff에서 변경되거나 삭제된 함수/클래스/메서드 시그니처가 " +
      "diff 밖의 다른 곳에서도 호출·참조되는지 search_codebase 도구로 확인한다. " +
      "diff가 그 호출부를 함께 수정하지 않은 경우만 문제로 지적한다. " +
      "확실하지 않으면 지적하지 말고 근거 없는 추측은 하지 않는다. " +
      "확인이 끝나면 findings로만 응답한다.",
    tools: [searchCodebase],
    output_config: { format: zodOutputFormat(FindingsSchema) },
    messages: [{ role: "user", content: `# diff\n${context.diff}` }],
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
