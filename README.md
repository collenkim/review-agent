# review-agent
소스 코드 리뷰 AI-Agent

## 구조
- `src/core` — 리뷰 로직 (dimension별 검사 + 결과 취합). CLI/GitHub Action이 공통으로 호출.
- `src/cli` — 로컬 실행용 CLI 진입점.
- `src/github-action` — CI 게이트용 진입점. PR diff를 받아 리뷰하고 PR에 코멘트, high 심각도 finding이 있으면 실패 처리.

현재 구현된 dimension:
- `convention` — 코드 컨벤션 위반 검사 (`--conventions` 필수). 구조화 출력만으로 충분해 단일 API 호출.
- `requirement` — 요구사항 충족 여부 검사 (`--requirement` 지정 시에만 실행). 마찬가지로 단일 API 호출.
- `blast-radius` — 타 영향 검토 (`--blast-radius` 지정 시에만 실행, 기본 off). `search_codebase`(git grep 기반) 도구를 Tool Runner로 호출해 diff 밖의 호출부를 찾는다 — 도구 호출이 들어가 비용이 더 크고 오탐 가능성도 있어 명시적으로 켜야 함.

## verify(반박) 단계

모든 dimension의 finding은 기본적으로 검증을 한 번 더 거칩니다(`src/core/verify.ts`). 별도의 Claude 호출로 "이 지적이 diff에 실제 근거가 있는가"를 회의적으로 재확인하고, 근거가 부족하면(refuted) 버립니다 — 오탐(특히 `blast-radius`)을 줄이기 위함입니다. finding 개수만큼 API 호출이 추가되니, 비용을 아끼거나 빠르게 훑어볼 때는 `--no-verify`로 끌 수 있습니다.

## plan(계획) 단계

`--plan`을 주면, 실제 dimension을 돌리기 전에 Claude가 diff를 먼저 보고 어떤 dimension이 이 diff에 실제로 의미가 있는지 판단합니다(`src/core/plan.ts`). 예를 들어 문서/주석만 바뀐 diff라면 `--blast-radius`를 켰어도 불필요하다고 판단해 건너뜁니다. **plan은 사용자가 CLI로 켠 dimension을 상한선으로 두고 그중 불필요한 것만 끄는 역할만 합니다** — 안 켠 dimension을 plan이 새로 켜지는 않습니다. 판단 이유는 결과에 함께 출력됩니다.

```bash
npm run review -- --conventions ./path/to/conventions.md --blast-radius --plan
```

## 사용법

```bash
npm install
npm run build

export ANTHROPIC_API_KEY=sk-ant-...
npm run review -- --conventions ./path/to/conventions.md
# 특정 diff 파일 지정
npm run review -- --conventions ./path/to/conventions.md --diff ./my.diff
# 요구사항 충족 여부도 함께 검토
npm run review -- --conventions ./path/to/conventions.md --requirement ./ticket.md
# 타 영향(blast radius)까지 검토 — repo가 review-agent 실행 위치와 다르면 --repo로 지정
npm run review -- --conventions ./path/to/conventions.md --blast-radius --repo /path/to/repo
# verify(반박) 단계 생략 — 속도/비용 우선일 때
npm run review -- --conventions ./path/to/conventions.md --no-verify
```

`--diff`를 생략하면 현재 디렉토리의 `git diff`(unstaged 변경분)를 사용합니다.

## 프롬프트 dry-run (API 비용 없이 프롬프트 확인/튜닝)

`--dry-run`을 주면 API를 전혀 호출하지 않고, 각 dimension이 실제로 보낼 system/user 프롬프트만 출력합니다. API 키가 없어도 동작합니다. 출력된 프롬프트를 claude.ai(구독 요금제 — API 종량제와 별도 과금) 등에 그대로 붙여넣어 결과를 확인하고, 만족스러운 문구가 나오면 그 내용을 각 dimension 파일의 `SYSTEM_PROMPT`에 반영하는 식으로 튜닝하면 됩니다.

```bash
npm run review -- --conventions ./path/to/conventions.md --dry-run
```

dimension마다 재현 정도가 다릅니다:
- `convention`, `requirement` — 단일 호출이라 완전히 동일하게 재현됨.
- `blast-radius` — `search_codebase` 도구를 여러 번 호출하는 다중 턴 대화라 **첫 턴만** 미리보기 가능. 실제 대화 흐름은 이 방식으로 못 봄.
- `verify` — finding을 입력으로 받는 구조라 실제 finding이 없으면 예시(더미) finding으로 형식만 보여줌.

## GitHub Action

PR이 열릴 때마다 자동으로 리뷰하고 싶은 다른 repo의 워크플로에서 이렇게 참조합니다:

```yaml
# .github/workflows/review.yml (리뷰 대상 repo에)
name: AI Code Review
on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: collenkim/review-agent@main
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        with:
          conventions: rules/code-conventions.md
          # requirement: docs/ticket.md   # 선택
          # blast-radius: 'true'          # 선택, 기본 false
```

`high` 심각도 finding이 하나라도 남으면 이 job이 실패합니다 — 브랜치 보호 규칙에 required check로 걸면 병합을 막는 게이트로 쓸 수 있습니다.

### 액션 자체를 수정했다면

이 action은 JS 액션이라 실행 시 `npm install`을 해주지 않습니다. `src/github-action`을 고쳤으면 번들도 다시 만들어서 커밋해야 반영됩니다:

```bash
npm run build:action   # action-dist/index.js 재생성
```

