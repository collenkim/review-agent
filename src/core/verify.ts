import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { DimensionResult, Finding, PromptPreview, ReviewContext } from "./types";

const VerdictSchema = z.object({
  refuted: z.boolean().describe("이 지적이 실제로는 틀렸거나 근거가 부족하면 true"),
  reason: z.string().describe("판단 근거를 한국어로 간단히"),
});

const SYSTEM_PROMPT =
  "너는 코드 리뷰 지적을 검증하는 반박자(refuter)다. 아래 지적이 실제로 diff에 " +
  "근거가 있는지 회의적으로 확인한다. diff 내용과 명확히 일치하고 근거가 충분할 " +
  "때만 refuted=false로 한다. 애매하거나 근거가 부족하면 refuted=true로 한다.";

function buildUserPrompt(finding: Finding, dimension: string, context: ReviewContext): string {
  const location = finding.file
    ? finding.line
      ? `${finding.file}:${finding.line}`
      : finding.file
    : "(diff 전체)";

  return (
    `# diff\n${context.diff}\n\n` +
    `# 검증할 지적 (dimension: ${dimension})\n` +
    `위치: ${location}\n심각도: ${finding.severity}\n내용: ${finding.summary}`
  );
}

const EXAMPLE_FINDING: Finding = {
  file: "src/example/File.java",
  line: 42,
  summary: "(예시) 실제 finding이 없어 넣은 샘플 — 진짜 검증 대상이 아님",
  severity: "medium",
};

export function previewVerifyPrompt(context: ReviewContext): PromptPreview {
  return {
    dimension: "verify",
    reproducible: false,
    note:
      "verify는 finding 하나당 한 번 호출되고, 그 finding의 실제 내용에 따라 " +
      "매번 user 프롬프트가 달라진다. 아래는 dimension이 실행 전이라 실제 finding이 " +
      "없어 예시 finding으로 채운 것 — system 프롬프트와 형식만 참고할 것.",
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(EXAMPLE_FINDING, "convention", context),
  };
}

const client = new Anthropic();

async function isRefuted(
  finding: Finding,
  dimension: string,
  context: ReviewContext,
): Promise<boolean> {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(finding, dimension, context) }],
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
