# review-agent 코드 컨벤션 (초안)

## 1. 기본
- TypeScript, Node.js 20+
- 들여쓰기 2 spaces
- 문자열은 큰따옴표(`"`) 사용
- 세미콜론 사용

## 2. 네이밍
| 대상 | 규칙 | 예 |
|---|---|---|
| 함수/변수 | camelCase | `runReview`, `conventionsText` |
| 타입/인터페이스 | PascalCase | `ReviewContext`, `DimensionResult` |
| 모듈 최상단 상수 | UPPER_SNAKE_CASE | `SYSTEM_PROMPT`, `MAX_RESULT_LINES` |
| 파일명 | camelCase | `blastRadius.ts`, `searchCodebase.ts` |

## 3. 함수 분리 원칙
- 각 dimension 파일은 "프롬프트 조립"과 "API 호출"을 분리한다.
  - `buildUserPrompt(...)` — user 프롬프트 문자열만 조립, API 호출 없음
  - `reviewXxx(...)` — 실제 API 호출, `buildUserPrompt` 결과를 사용
  - `previewXxxPrompt(...)` — dry-run용, `buildUserPrompt`/`SYSTEM_PROMPT`를 그대로 재사용해 미리보기 반환
- 하나의 함수가 "프롬프트를 만들면서 동시에 호출까지" 하지 않는다.

## 4. 비동기 처리
- `.then()` 체이닝 대신 `async/await`를 쓴다.
- 서로 독립적으로 실행 가능한 작업은 `Promise.all`로 묶는다 (예: 여러 dimension 동시 실행).
- 순서가 중요한 작업(예: plan 결과에 따라 이후 실행 여부가 갈리는 경우)만 순차 `await`로 둔다.

## 5. 타입
- `any` 사용 금지. 불가피하면 `unknown` + 타입가드로 좁힌다.
- 타입 시스템이 표현 못 하는 경우(예: 외부 라이브러리의 타입 정의 오류)에만 `as`로 캐스팅하고, 왜 필요한지 주석을 남긴다.
- 함수의 입력/출력 타입은 명시적으로 선언한다. 추론에만 의존하지 않는다.

## 6. 에러 처리
- 실패를 조용히 삼키지 않는다. 다만 파싱 실패 등 판단 불가 상황은 "안전한 기본값"으로 폴백하고, 왜 그 기본값을 골랐는지 주석으로 남긴다 (예: verify에서 파싱 실패 시 `refuted: true`로 처리).
- 최상위 진입점(`cli/index.ts`, `github-action/index.ts`)에서만 전체를 catch해서 종료/실패 처리를 한다. 중간 계층에서 임의로 삼키지 않는다.

## 7. import 순서
- 외부 패키지 → 내부 모듈(`../`, `./`) 순으로 정렬하고, 그룹 사이에 빈 줄을 둔다.

## 8. 주석
- "무엇을 하는지"가 아니라 "왜 이렇게 했는지"를 설명한다. 코드를 그대로 반복하는 주석은 금지.
- 함수/타입에 대한 설명은 JSDoc(`/** ... */`)으로, 한 줄이면 충분한 경우 여러 줄로 늘리지 않는다.
