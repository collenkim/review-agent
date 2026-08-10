import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DimensionResult, ReviewContext } from "../types";

const FindingsSchema = z.object({
  findings: z.array(
    z.object({
      file: z.string(),
      line: z.number().optional(),
      summary: z.string().describe("어떤 컨벤션을 왜 위반했는지 한국어로 설명"),
      severity: z.enum(["high", "medium", "low"]),
    }),
  ),
});

const client = new Anthropic();

export async function reviewConvention(
  context: ReviewContext,
  conventionsText: string,
): Promise<DimensionResult> {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    system:
      "너는 코드 리뷰어다. 아래 프로젝트 컨벤션 문서를 기준으로 diff에서 컨벤션 위반만 찾는다. " +
      "버그나 로직 문제는 다루지 않는다. 위반이 없으면 빈 배열을 반환한다.",
    messages: [
      {
        role: "user",
        content: `# 컨벤션 문서\n${conventionsText}\n\n# 리뷰할 diff\n${context.diff}`,
      },
    ],
    output_config: { format: zodOutputFormat(FindingsSchema) },
  });

  const parsed = response.parsed_output;
  return { dimension: "convention", findings: parsed?.findings ?? [] };
}
