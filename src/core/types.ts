export interface ReviewContext {
  /** unified diff text to review */
  diff: string;
  /** path to a markdown file describing the project's code conventions */
  conventionsPath: string;
  /** path to a text/markdown file describing the requirement this diff should satisfy */
  requirementPath?: string;
  /** blast-radius(타 영향) dimension 실행 여부 — 기본 off (도구 호출이 들어가 비용이 더 큼) */
  checkBlastRadius?: boolean;
  /** blast-radius 검색 대상 저장소 루트. 생략 시 현재 작업 디렉토리 */
  repoRoot?: string;
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
