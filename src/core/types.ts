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
  /** finding별 반박(verify) 단계 실행 여부. 기본 true — false만 명시적으로 꺼짐 */
  verify?: boolean;
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
