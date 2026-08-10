import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DimensionResult, Finding, ReviewContext } from "./types";

const VerdictSchema = z.object({
  refuted: z.boolean().describe("이 지적이 실제로는 틀렸거나 근거가 부족하면 true"),
  reason: z.string().describe("판단 근거를 한국어로 간단히"),
});

const client = new Anthropic();

async function isRefuted(
  finding: Finding,
  dimension: string,
  context: ReviewContext,
): Promise<boolean> {
  const location = finding.file
    ? finding.line
      ? `${finding.file}:${finding.line}`
      : finding.file
    : "(diff 전체)";

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2000,
    system:
      "너는 코드 리뷰 지적을 검증하는 반박자(refuter)다. 아래 지적이 실제로 diff에 " +
      "근거가 있는지 회의적으로 확인한다. diff 내용과 명확히 일치하고 근거가 충분할 " +
      "때만 refuted=false로 한다. 애매하거나 근거가 부족하면 refuted=true로 한다.",
    messages: [
      {
        role: "user",
        content:
          `# diff\n${context.diff}\n\n` +
          `# 검증할 지적 (dimension: ${dimension})\n` +
          `위치: ${location}\n심각도: ${finding.severity}\n내용: ${finding.summary}`,
      },
    ],
    output_config: { format: zodOutputFormat(VerdictSchema) },
  });

  // 파싱 실패 등 판단 불가 상황은 안전하게 반박된 것으로 처리(false positive 방지 우선)
  return response.parsed_output?.refuted ?? true;
}

/** 각 dimension의 findings를 반박 시도 후, 살아남은 것만 남긴다. */
export async function verifyResults(
  results: DimensionResult[],
  context: ReviewContext,
): Promise<DimensionResult[]> {
  return Promise.all(
    results.map(async (result) => {
      const verdicts = await Promise.all(
        result.findings.map(async (finding) => ({
          finding,
          refuted: await isRefuted(finding, result.dimension, context),
        })),
      );
      return {
        dimension: result.dimension,
        findings: verdicts.filter((v) => !v.refuted).map((v) => v.finding),
      };
    }),
  );
}
