export interface ReviewContext {
  /** unified diff text to review */
  diff: string;
  /** path to a markdown file describing the project's code conventions */
  conventionsPath: string;
}

export type Severity = "high" | "medium" | "low";

export interface Finding {
  file: string;
  line?: number;
  summary: string;
  severity: Severity;
}

export interface DimensionResult {
  dimension: string;
  findings: Finding[];
}
