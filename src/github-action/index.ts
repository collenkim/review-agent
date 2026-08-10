import * as core from "@actions/core";
import * as github from "@actions/github";
import { runReview } from "../core/review";
import type { DimensionResult } from "../core/types";

function formatComment(results: DimensionResult[]): string {
  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  const lines: string[] = ["## 🤖 AI 코드 리뷰"];

  if (totalFindings === 0) {
    lines.push("발견된 문제가 없습니다.");
    return lines.join("\n");
  }

  for (const result of results) {
    if (result.findings.length === 0) continue;
    lines.push(`\n### ${result.dimension}`);
    for (const finding of result.findings) {
      const location = finding.file
        ? finding.line
          ? `\`${finding.file}:${finding.line}\``
          : `\`${finding.file}\``
        : "(전체)";
      lines.push(`- **[${finding.severity}]** ${location} — ${finding.summary}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const token = core.getInput("github-token", { required: true });
  const conventionsPath = core.getInput("conventions", { required: true });
  const requirementPath = core.getInput("requirement") || undefined;
  const checkBlastRadius = core.getInput("blast-radius") === "true";
  const verify = core.getInput("verify") !== "false";

  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    core.setFailed("이 action은 pull_request 이벤트에서만 동작합니다.");
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  // mediaType: {format: "diff"}를 쓰면 응답 data가 JSON이 아니라 diff 원문 문자열로 온다
  // (Octokit 타입 정의는 이를 반영하지 않아 캐스팅이 필요함)
  const diffResponse = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullRequest.number,
    mediaType: { format: "diff" },
  });
  const diff = diffResponse.data as unknown as string;

  if (!diff.trim()) {
    core.info("diff가 비어 있습니다. 리뷰할 변경사항이 없어요.");
    return;
  }

  const results = await runReview({
    diff,
    conventionsPath,
    requirementPath,
    checkBlastRadius,
    repoRoot: process.env.GITHUB_WORKSPACE,
    verify,
  });

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullRequest.number,
    body: formatComment(results),
  });

  const hasHighSeverity = results.some((r) =>
    r.findings.some((f) => f.severity === "high"),
  );
  if (hasHighSeverity) {
    core.setFailed("high 심각도 finding이 있어 리뷰를 통과하지 못했습니다.");
  }
}

main().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
