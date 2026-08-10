# review-agent
소스 코드 리뷰 AI-Agent

## 구조
- `src/core` — 리뷰 로직 (dimension별 검사 + 결과 취합). CLI/GitHub Action이 공통으로 호출.
- `src/cli` — 로컬 실행용 CLI 진입점.
- `src/github-action` — CI 게이트용 진입점 (TODO, 아직 미구현).

현재 구현된 dimension:
- `convention` — 코드 컨벤션 위반 검사 (`--conventions` 필수). 구조화 출력만으로 충분해 단일 API 호출.
- `requirement` — 요구사항 충족 여부 검사 (`--requirement` 지정 시에만 실행). 마찬가지로 단일 API 호출.
- `blast-radius` — 타 영향 검토 (`--blast-radius` 지정 시에만 실행, 기본 off). `search_codebase`(git grep 기반) 도구를 Tool Runner로 호출해 diff 밖의 호출부를 찾는다 — 도구 호출이 들어가 비용이 더 크고 오탐 가능성도 있어 명시적으로 켜야 함.

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
```

`--diff`를 생략하면 현재 디렉토리의 `git diff`(unstaged 변경분)를 사용합니다.

