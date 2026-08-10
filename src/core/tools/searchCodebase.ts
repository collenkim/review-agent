import { spawnSync } from "child_process";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const MAX_RESULT_LINES = 50;

/**
 * git grep 기반 코드베이스 검색 도구.
 * repoRoot는 CLI에서 고정한 경로만 쓰고, 모델은 검색어(query)만 제공한다
 * (경로 traversal 여지 없음). 정규식이 아닌 fixed-string 검색으로 제한해
 * 모델이 검색어에 무엇을 넣어도 셸 메타문자 해석 위험이 없다.
 */
export function createSearchCodebaseTool(repoRoot: string) {
  return betaZodTool({
    name: "search_codebase",
    description:
      "리뷰 대상 저장소(git 추적 파일)에서 문자열을 검색한다. " +
      "diff에서 변경/삭제된 함수·클래스·메서드 이름이 다른 파일에서도 쓰이는지 확인할 때 사용한다. " +
      "정규식이 아닌 입력한 문자열 그대로(fixed string)로 검색된다.",
    inputSchema: z.object({
      query: z.string().describe("검색할 식별자 또는 문자열"),
    }),
    run: async ({ query }) => {
      const result = spawnSync("git", ["grep", "-n", "-F", "--", query], {
        cwd: repoRoot,
        encoding: "utf-8",
      });

      if (result.error) {
        return `검색 실패: ${result.error.message}`;
      }
      // git grep exit code: 0=매치 있음, 1=매치 없음(정상), 그 외=에러
      if (result.status !== 0 && result.status !== 1) {
        return `검색 실패 (git grep exit ${result.status}): ${result.stderr}`;
      }
      if (!result.stdout.trim()) {
        return "일치하는 결과 없음";
      }

      const lines = result.stdout.trim().split("\n");
      if (lines.length > MAX_RESULT_LINES) {
        const shown = lines.slice(0, MAX_RESULT_LINES).join("\n");
        return `${shown}\n... (총 ${lines.length}건 중 ${MAX_RESULT_LINES}건만 표시)`;
      }
      return lines.join("\n");
    },
  });
}
