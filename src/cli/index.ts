#!/usr/bin/env node
import { execSync } from "child_process";
import { runReview } from "../core/review";

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.conventions) {
    console.error(
      "사용법: review-agent --conventions <컨벤션문서.md> [--diff <diff파일>] [--requirement <요구사항문서.md>]",
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

  const results = await runReview({
    diff,
    conventionsPath: args.conventions,
    requirementPath: args.requirement,
  });

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
