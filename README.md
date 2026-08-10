# review-agent
소스 코드 리뷰 AI-Agent

## 구조
- `src/core` — 리뷰 로직 (dimension별 검사 + 결과 취합). CLI/GitHub Action이 공통으로 호출.
- `src/cli` — 로컬 실행용 CLI 진입점.
- `src/github-action` — CI 게이트용 진입점 (TODO, 아직 미구현).

현재 구현된 dimension: `convention`(코드 컨벤션 위반 검사). 요구사항 매칭, blast radius 등은 후속 작업.

## 사용법

```bash
npm install
npm run build

export ANTHROPIC_API_KEY=sk-ant-...
npm run review -- --conventions ./path/to/conventions.md
# 또는 특정 diff 파일 지정
npm run review -- --conventions ./path/to/conventions.md --diff ./my.diff
```

`--diff`를 생략하면 현재 디렉토리의 `git diff`(unstaged 변경분)를 사용합니다.

