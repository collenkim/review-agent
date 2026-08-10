#!/usr/bin/env node
import { spawnSync } from "child_process";
import { readFileSync } from "fs";

import { buildDryRunPreviews, formatDryRunReport } from "../core/dryRun";
import { runReview } from "../core/review";

const MAX_DIFF_BYTES = 50 * 1024 * 1024;

/**
 * 리뷰할 diff를 구한다. 우선순위: --diff(파일) > --base(브랜치 비교) > 현재 unstaged 변경분.
 * 브랜치명은 shell을 거치지 않는 spawnSync 인자로만 넘겨 명령어 주입 여지를 없앤다.
 */
function resolveDiff(args: Record<string, string>): string {
  if (args.diff) {
    return readFileSync(args.diff, "utf-8");
  }

  // `base...HEAD`는 두 브랜치가 갈라진 지점부터의 변경분 — PR에서 보는 범위와 같다
  const gitArgs = args.base ? ["diff", `${args.base}...HEAD`] : ["diff"];
  const result = spawnSync("git", gitArgs, {
    encoding: "utf-8",
    maxBuffer: MAX_DIFF_BYTES,
  });

  if (result.error) {
    throw new Error(`git 실행 실패: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`git ${gitArgs.join(" ")} 실패 (exit ${result.status}): ${result.stderr}`);
  }
  return result.stdout;
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      // 다음 토큰이 값이면 소비, 없거나 다음 플래그면 불리언 플래그로 처리
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.conventions) {
    console.error(
      "사용법: review-agent --conventions <컨벤션문서.md> " +
        "[--base <비교기준브랜치>] [--diff <diff파일>] [--requirement <요구사항문서.md>] " +
        "[--policy <검증범위정책.md>] [--test-coverage] [--blast-radius] " +
        "[--repo <저장소경로>] [--no-verify] [--dry-run] [--plan]",
    );
    process.exit(1);
  }

  const diff = resolveDiff(args);

  if (!diff.trim()) {
    const source = args.diff
      ? `diff 파일(${args.diff})이 비어 있습니다.`
      : args.base
        ? `${args.base} 기준으로 변경된 내용이 없습니다.`
        : "unstaged 변경사항이 없습니다. 커밋된 변경을 리뷰하려면 --base <브랜치>를 쓰세요.";
    console.log(source);
    return;
  }

  const context = {
    diff,
    conventionsPath: args.conventions,
    requirementPath: args.requirement,
    policyPath: args.policy,
    checkBlastRadius: args["blast-radius"] === "true",
    checkTestCoverage: args["test-coverage"] === "true",
    repoRoot: args.repo,
    verify: args["no-verify"] !== "true",
    plan: args.plan === "true",
  };

  if (args["dry-run"] === "true") {
    console.log(formatDryRunReport(buildDryRunPreviews(context)));
    console.log(
      "\n(API 호출 없음 — 위 프롬프트를 claude.ai 등에 직접 붙여넣어 확인하세요.)",
    );
    return;
  }

  const { results, plan } = await runReview(context);

  if (plan) {
    console.log(
      `\n## plan\nconvention=${plan.runConvention} requirement=${plan.runRequirement} ` +
        `blast-radius=${plan.runBlastRadius} test-coverage=${plan.runTestCoverage}\n${plan.reasoning}`,
    );
  }

  for (const result of results) {
    console.log(`\n## ${result.dimension}`);
    if (result.findings.length === 0) {
      console.log("발견된 문제 없음");
      continue;
    }
    for (const finding of result.findings) {
      const location = finding.file
        ? finding.line
          ? `${finding.file}:${finding.line}`
          : finding.file
        : "(전체)";
      console.log(`[${finding.severity}] ${location} — ${finding.summary}`);
    }
  }
}

main().catch((err) => {
  // 대부분 경로 오타·브랜치명 오타 같은 사용자 실수라 메시지만 보여준다.
  // 스택이 필요하면 REVIEW_AGENT_DEBUG=1로 실행.
  console.error(process.env.REVIEW_AGENT_DEBUG ? err : `오류: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
