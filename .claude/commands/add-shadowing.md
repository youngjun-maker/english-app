섀도잉 영상을 YouTube에서 다운로드해서 앱에 추가하는 커맨드입니다.

## 인자 형식
$ARGUMENTS

인자는 다음 순서로 파싱합니다:
1. YouTube URL (필수)
2. 시작 시간 (필수) — `MM:SS` 또는 `H:MM:SS` 형식
3. 종료 시간 (필수) — `MM:SS` 또는 `H:MM:SS` 형식
4. 제목 (선택) — 없으면 YouTube 제목 자동 사용
5. 난이도 (선택) — `easy` / `medium` / `hard`, 기본값 `medium`
6. 카테고리 (선택) — `movie` / `speech` / `ted`, 기본값 `speech`

## 실행 방법

아래 명령어를 Bash 툴로 실행하세요:

```bash
cd C:/Users/fyuer/workspace/english-app && node scripts/add-shadowing.js $ARGUMENTS
```

실행 중 오류가 발생하면 에러 메시지를 확인하고 원인을 파악해서 해결해주세요.

완료 후 결과(content_id, 제목, 스크립트 개수)를 사용자에게 보고하세요.
