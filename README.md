# review-agent
소스 코드 리뷰 AI-Agent

## 구조
- `src/core` — 리뷰 로직 (dimension별 검사 + 결과 취합). CLI/GitHub Action이 공통으로 호출.
- `src/cli` — 로컬 실행용 CLI 진입점.
- `src/github-action` — CI 게이트용 진입점. PR diff를 받아 리뷰하고 PR에 코멘트, high 심각도 finding이 있으면 실패 처리.

현재 구현된 dimension:
- `convention` — 코드 컨벤션 위반 검사 (`--conventions` 필수). 구조화 출력만으로 충분해 단일 API 호출.
- `requirement` — 요구사항 충족 여부 검사 (`--requirement` 지정 시, GitHub Action은 PR 본문으로 자동). 마찬가지로 단일 API 호출.
- `test-coverage` — 변경된 동작에 테스트가 동반됐는지 검사 (`--test-coverage` 지정 시에만 실행, 기본 off). 단일 API 호출.
- `blast-radius` — 타 영향 검토 (`--blast-radius` 지정 시에만 실행, 기본 off). `search_codebase`(git grep 기반) 도구를 Tool Runner로 호출해 diff 밖의 호출부를 찾는다 — 도구 호출이 들어가 비용이 더 크고 오탐 가능성도 있어 명시적으로 켜야 함.

## 검증 범위 정책 (`--policy`)

"무엇을 지적할 것인가"(dimension)와 별개로, **"무엇을 지적하고 무엇을 지적하지 않을 것인가"**를 정하는 정책 문서를 넘길 수 있습니다. 특정 검사 항목이 아니라 **모든 dimension과 verify 단계에 공통 주입**되어 리뷰 전체의 범위를 제한합니다.

```bash
review-agent --conventions ./conventions.md --policy ./review-policy.md --base main
```

정책 문서에 넣을 만한 것들:
- 지적 대상 범위 — "변경된 줄만", "원래 있던 문제는 제외"
- 제외 항목 — "포매터가 잡는 스타일은 제외", "생성된 코드 제외"
- 심각도 기준 — 무엇이 `high`이고 무엇이 `low`인지
- 테스트 요구 수준 — `--test-coverage`를 쓸 때 어디까지 테스트를 요구할지

`docs/review-policy.example.md`에 예시 템플릿이 있습니다. 복사해서 프로젝트에 맞게 고쳐 쓰세요.

정책 없이도 동작하지만, **노이즈(오탐·사소한 지적)를 줄이는 데는 정책이 가장 효과가 큽니다** — 각 dimension 프롬프트에 하드코딩된 기본 규칙만으로는 프로젝트마다 다른 기준을 표현할 수 없기 때문입니다.

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
# 브랜치 단위로 리뷰 (main 기준 현재 브랜치의 변경분)
npm run review -- --conventions ./path/to/conventions.md --base main
# 특정 diff 파일 지정
npm run review -- --conventions ./path/to/conventions.md --diff ./my.diff
# 요구사항 충족 여부도 함께 검토
npm run review -- --conventions ./path/to/conventions.md --requirement ./ticket.md
# 검증 범위 정책 적용 (모든 dimension에 공통)
npm run review -- --conventions ./path/to/conventions.md --policy ./review-policy.md
# 테스트 동반 여부까지 검토
npm run review -- --conventions ./path/to/conventions.md --test-coverage
# 타 영향(blast radius)까지 검토 — repo가 review-agent 실행 위치와 다르면 --repo로 지정
npm run review -- --conventions ./path/to/conventions.md --blast-radius --repo /path/to/repo
# verify(반박) 단계 생략 — 속도/비용 우선일 때
npm run review -- --conventions ./path/to/conventions.md --no-verify
```

`--diff`와 `--base`를 둘 다 생략하면 현재 디렉토리의 `git diff`(**unstaged 변경분만**)를 사용합니다. 커밋된 변경을 리뷰하려면 `--base <브랜치>`를 쓰세요.

## 다른 프로젝트를 리뷰하기

review-agent는 컨벤션 내용을 전혀 모르고, 넘겨받은 문서를 프롬프트에 그대로 꽂아 넣기만 합니다. 그래서 언어·프로젝트마다 자기 컨벤션 문서를 가리키기만 하면 됩니다 (Java든 TS든 Python이든 동일).

### 1. 실행 방법 — `npm run review`는 review-agent 폴더 안에서만 동작

다른 프로젝트에서 쓰려면 둘 중 하나:

```bash
# 방법 A: 한 번만 등록해두면 어디서든 review-agent 명령 사용 가능 (권장)
cd /path/to/review-agent
npm link

# 이후 어느 프로젝트에서든
cd /path/to/my-project
review-agent --conventions ./docs/style-guide.md --dry-run

# 방법 B: 절대경로로 직접 실행
cd /path/to/my-project
node /path/to/review-agent/dist/cli/index.js --conventions ./docs/style-guide.md --dry-run
```

`blast-radius`를 쓸 때 `--repo`를 생략하면 **현재 작업 디렉토리**를 검색 대상으로 삼으므로, 리뷰 대상 프로젝트 안에서 실행하면 따로 지정할 필요가 없습니다.

### 2. 커밋 / 브랜치 단위로 리뷰하기

`--base <브랜치>`로 비교 기준을 주면 됩니다. 내부적으로 `git diff <base>...HEAD`를 실행하므로, **두 브랜치가 갈라진 지점부터의 변경분** — PR에서 보는 범위와 같습니다.

```bash
cd /path/to/my-project
git checkout feature/my-branch

review-agent --conventions ./docs/style-guide.md --base main --dry-run
```

diff를 어디서 가져올지는 이 순서로 정해집니다:

| 옵션 | 대상 |
|---|---|
| `--diff <파일>` | 미리 만들어둔 diff 파일 |
| `--base <브랜치>` | `git diff <base>...HEAD` — 브랜치 전체 변경분 |
| (둘 다 없음) | `git diff` — **unstaged 변경분만** |

`--base`로 표현이 안 되는 범위(특정 커밋 하나, staged만 등)는 diff를 직접 뽑아 `--diff`로 넘기세요:

```bash
git show <commit-sha> > review.diff     # 특정 커밋 하나
git diff --staged > review.diff         # staged 변경분
review-agent --conventions ./docs/style-guide.md --diff review.diff --dry-run
```

### 3. 컨벤션 문서 위치

컨벤션 문서가 리뷰 대상 repo 밖에 있어도 됩니다 — 경로만 맞으면 절대경로도 동작합니다:

```bash
review-agent --conventions "/path/to/docs-repo/rules/code-conventions.md" --diff review.diff --dry-run
```

## 프롬프트 dry-run (API 비용 없이 프롬프트 확인/튜닝)

`--dry-run`을 주면 API를 전혀 호출하지 않고, 각 dimension이 실제로 보낼 system/user 프롬프트만 출력합니다. API 키가 없어도 동작합니다. 출력된 프롬프트를 claude.ai(구독 요금제 — API 종량제와 별도 과금) 등에 그대로 붙여넣어 결과를 확인하고, 만족스러운 문구가 나오면 그 내용을 각 dimension 파일의 `SYSTEM_PROMPT`에 반영하는 식으로 튜닝하면 됩니다.

```bash
npm run review -- --conventions ./path/to/conventions.md --dry-run

# 터미널에서 복사하기 번거로우면 클립보드로 바로 (PowerShell)
review-agent --conventions ./docs/style-guide.md --base main --no-verify --dry-run | Set-Clipboard
```

dimension마다 재현 정도가 다릅니다:
- `convention`, `requirement` — 단일 호출이라 완전히 동일하게 재현됨.
- `blast-radius` — `search_codebase` 도구를 여러 번 호출하는 다중 턴 대화라 **첫 턴만** 미리보기 가능. 실제 대화 흐름은 이 방식으로 못 봄.
- `verify` — finding을 입력으로 받는 구조라 실제 finding이 없으면 예시(더미) finding으로 형식만 보여줌.

### claude.ai에 붙여넣을 때 실제 API 호출과 다른 점

프롬프트 문구를 다듬는 용도로는 충분하지만, 아래 두 가지는 완전히 동일하지 않습니다:

1. **system 프롬프트가 분리되지 않음** — API는 system을 별도 필드로 보내지만 claude.ai 일반 채팅에는 그런 필드가 없어, system+user가 한 덩어리 사용자 메시지로 들어갑니다. 지시 준수 강도가 미묘하게 다를 수 있습니다.
2. **출력 스키마 강제가 없음** — 실제 코드는 `output_config.format`으로 `{findings: [{file, line, summary, severity}]}` JSON을 강제하지만, dry-run 출력에는 이 스키마가 포함되지 않습니다. claude.ai에서는 산문으로 답합니다.

## 테스트 픽스처

API 키 없이 동작을 확인할 수 있도록 샘플 한 벌이 들어 있습니다:

- `docs/conventions.md` — review-agent 자체(TypeScript) 기준 컨벤션 초안
- `fixtures/sample.diff` — 위 컨벤션을 의도적으로 여러 개 위반하는 diff (snake_case 함수명, `any`, 작은따옴표, 세미콜론 누락, 코드 반복 주석, 프롬프트 조립·호출 미분리, import 순서)

```bash
npm run review -- --conventions docs/conventions.md --diff fixtures/sample.diff --no-verify --dry-run
```

`docs/conventions.md`는 어디까지나 **review-agent 자신을 리뷰 대상으로 삼을 때 쓰는 샘플**입니다. 다른 프로젝트에 적용할 때는 그 프로젝트의 컨벤션 문서를 가리키세요.

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
          # policy: docs/review-policy.md  # 선택, 검증 범위 정책
          # requirement: docs/ticket.md    # 선택, 생략하면 PR 본문을 요구사항으로 사용
          # test-coverage: 'true'          # 선택, 기본 false
          # blast-radius: 'true'           # 선택, 기본 false
          # plan: 'true'                   # 선택, 기본 false
          # verify: 'false'                # 선택, 기본 true
```

CLI와 두 가지가 다릅니다:
- **diff를 직접 만들 필요 없음** — PR의 전체 변경분을 GitHub API에서 받아옵니다.
- **요구사항을 PR 본문에서 자동 수집** — `requirement` 파일을 주지 않으면 PR 본문을 요구사항으로 씁니다. 요구사항은 보통 repo 안의 파일이 아니라 PR/티켓에 적히기 때문입니다. 본문이 비어 있으면 requirement dimension은 그냥 건너뜁니다. 이 동작이 싫으면 `requirement-from-pr-body: 'false'`.

`high` 심각도 finding이 하나라도 남으면 이 job이 실패합니다 — 브랜치 보호 규칙에 required check로 걸면 병합을 막는 게이트로 쓸 수 있습니다.

### 액션 자체를 수정했다면

이 action은 JS 액션이라 실행 시 `npm install`을 해주지 않습니다. `src/github-action`을 고쳤으면 번들도 다시 만들어서 커밋해야 반영됩니다:

```bash
npm run build:action   # action-dist/index.js 재생성
```

