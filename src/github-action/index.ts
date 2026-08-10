import * as core from "@actions/core";
import * as github from "@actions/github";
import { runReview } from "../core/review";
import type { DimensionResult, ReviewPlan } from "../core/types";

function formatComment(results: DimensionResult[], plan?: ReviewPlan): string {
  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  const lines: string[] = ["## 🤖 AI 코드 리뷰"];

  if (plan) {
    lines.push(
      `\n<details><summary>실행 계획</summary>\n\n` +
        `convention=${plan.runConvention} requirement=${plan.runRequirement} ` +
        `blast-radius=${plan.runBlastRadius} test-coverage=${plan.runTestCoverage}\n\n` +
        `${plan.reasoning}\n</details>`,
    );
  }

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
  const policyPath = core.getInput("policy") || undefined;
  const checkBlastRadius = core.getInput("blast-radius") === "true";
  const checkTestCoverage = core.getInput("test-coverage") === "true";
  const usePrBodyAsRequirement = core.getInput("requirement-from-pr-body") !== "false";
  const verify = core.getInput("verify") !== "false";
  const plan = core.getInput("plan") === "true";

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

  // 요구사항은 보통 repo 안의 파일이 아니라 PR 본문에 적힌다. requirement 파일을
  // 따로 주지 않았다면 PR 본문을 요구사항으로 쓴다(빈 본문이면 dimension 자체가 스킵됨).
  const prBody = typeof pullRequest.body === "string" ? pullRequest.body : "";
  const requirementText =
    !requirementPath && usePrBodyAsRequirement && prBody.trim() ? prBody : undefined;

  if (requirementText) {
    core.info("requirement 파일이 없어 PR 본문을 요구사항으로 사용합니다.");
  }

  const { results, plan: appliedPlan } = await runReview({
    diff,
    conventionsPath,
    requirementPath,
    requirementText,
    policyPath,
    checkBlastRadius,
    checkTestCoverage,
    repoRoot: process.env.GITHUB_WORKSPACE,
    verify,
    plan,
  });

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullRequest.number,
    body: formatComment(results, appliedPlan),
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
