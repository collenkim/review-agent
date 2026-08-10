#!/usr/bin/env node
import { execSync } from "child_process";
import { buildDryRunPreviews, formatDryRunReport } from "../core/dryRun";
import { runReview } from "../core/review";

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
        "[--diff <diff파일>] [--requirement <요구사항문서.md>] " +
        "[--blast-radius] [--repo <저장소경로>] [--no-verify] [--dry-run] [--plan]",
    );
    process.exit(1);
  }

  const diff = args.diff
    ? require("fs").readFileSync(args.diff, "utf-8")
    : execSync("git diff", { encoding: "utf-8" });

  if (!diff.trim()) {
    console.log("diff가 비어 있습니다. 리뷰할 변경사항이 없어요.");
    return;
  }

  const context = {
    diff,
    conventionsPath: args.conventions,
    requirementPath: args.requirement,
    checkBlastRadius: args["blast-radius"] === "true",
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
      `\n## plan\nconvention=${plan.runConvention} requirement=${plan.runRequirement} blast-radius=${plan.runBlastRadius}\n${plan.reasoning}`,
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
  console.error(err);
  process.exit(1);
});
