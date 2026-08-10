export interface ReviewContext {
  /** unified diff text to review */
  diff: string;
  /** path to a markdown file describing the project's code conventions */
  conventionsPath: string;
  /** 요구사항 문서 경로. requirementText가 있으면 그쪽이 우선한다. */
  requirementPath?: string;
  /**
   * 파일이 아닌 곳에서 받은 요구사항 원문 (예: GitHub Action이 넘기는 PR 본문).
   * 요구사항은 보통 티켓/PR에 있지 repo 안의 파일이 아니라서 텍스트 입력도 받는다.
   */
  requirementText?: string;
  /**
   * 검증 범위 정책 문서 경로. 무엇을 지적하고 무엇을 지적하지 않을지를 정하며
   * 특정 검사 항목이 아니라 모든 dimension에 공통으로 주입된다.
   */
  policyPath?: string;
  /** policyPath를 읽어 내부에서 채우는 값 — 호출자가 직접 넣지 않는다. */
  policyText?: string;
  /** blast-radius(타 영향) dimension 실행 여부 — 기본 off (도구 호출이 들어가 비용이 더 큼) */
  checkBlastRadius?: boolean;
  /** test-coverage(테스트 동반 여부) dimension 실행 여부 — 기본 off */
  checkTestCoverage?: boolean;
  /** blast-radius 검색 대상 저장소 루트. 생략 시 현재 작업 디렉토리 */
  repoRoot?: string;
  /** finding별 반박(verify) 단계 실행 여부. 기본 true — false만 명시적으로 꺼짐 */
  verify?: boolean;
  /**
   * 실행 전 Claude가 diff를 보고 어떤 dimension이 실제로 필요한지 판단하게 할지.
   * 기본 false. 켜져 있어도 사용자가 명시적으로 켜지 않은 dimension을 plan이
   * 새로 켜지는 않음 — 이미 켠 것 중 불필요한 걸 끄는 역할만 함(상한선은 항상 사용자 지정값).
   */
  plan?: boolean;
}

export interface ReviewPlan {
  runConvention: boolean;
  runRequirement: boolean;
  runBlastRadius: boolean;
  runTestCoverage: boolean;
  reasoning: string;
}

export interface ReviewOutcome {
  results: DimensionResult[];
  plan?: ReviewPlan;
}

export type Severity = "high" | "medium" | "low";

export interface Finding {
  /** 파일 단위로 특정하기 어려운 발견(예: 요구사항 미충족)은 생략 가능 */
  file?: string;
  line?: number;
  summary: string;
  severity: Severity;
}

export interface DimensionResult {
  dimension: string;
  findings: Finding[];
}

/** 실제 API 호출 없이 미리보기(dry-run)할 때 쓰는, 조립된 프롬프트 한 벌 */
export interface PromptPreview {
  dimension: string;
  /** 이 프롬프트로 실제 결과를 재현할 수 있는지. blast-radius/verify는 도구 호출·finding 입력에
   *  따라 이후 대화가 갈리거나 예시 데이터를 쓰므로 false */
  reproducible: boolean;
  note?: string;
  system: string;
  user: string;
}
