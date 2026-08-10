/**
 * 검증 범위 정책을 user 프롬프트 맨 앞에 덧붙인다.
 *
 * 정책은 "무엇을 검사하느냐"(dimension)가 아니라 "무엇을 지적하고 무엇을 지적하지
 * 않느냐"를 정하는 규칙이라 특정 dimension에 속하지 않고 전부에 공통 적용된다.
 * 뒤따르는 내용(컨벤션 문서·diff 등)을 해석하는 틀이 되도록 맨 앞에 둔다.
 */
export function withPolicy(userPrompt: string, policyText?: string): string {
  if (!policyText?.trim()) {
    return userPrompt;
  }

  return (
    "# 검증 범위 정책\n" +
    "아래 정책은 이 리뷰에서 무엇을 지적하고 무엇을 지적하지 않을지를 정한다. " +
    "다른 지시와 충돌하면 이 정책을 우선한다.\n\n" +
    `${policyText}\n\n${userPrompt}`
  );
}
