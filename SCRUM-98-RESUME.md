# SCRUM-98 재개 가이드

브랜치: `feat/SCRUM-98` (푸시 완료: `3bbe941`)

## 현재 상태

구조물 제약 설정 GUI 재설계 + 예산 개념 제거 작업이 **구현 및 1차 E2E 검증 완료** 상태입니다.

### 완료된 것

1. **예산 개념 제거**
   - 프론트: 예산 선택 카드 3개(빠른/표준/전수) 폐기, `estimate`/`BudgetPreset`/`budget` 파라미터 제거
   - 백엔드: `StartStudyRequest.budget` 제거, `STANDARD` 고정, `estimate` 엔드포인트 제거
2. **풀스크린 제약 설정 페이지** (SimulationSetupPage 스타일)
   - 헤더(뒤로/제목/시작 버튼) + 좌측 Konva 캔버스 + 우측 300px 패널(구조물 목록/제약/금지 영역)
   - `/simulations/:id/layout-search` 진입 시 바로 제약 설정 화면
3. **버그 수정**
   - `ConstraintEditor` `onWheel` passive 리스너 오류 → `{ passive: false }` 네이티브 리스너로 수정
   - "기준 실행 1회 약 약 1초" 중복 텍스트
   - `constraints.py`: 0 이하 크기 금지 영역 필터링 + float 키 내성 파싱
4. **엣지케이스 테스트** `engine/test_constraints_edgecases.py` — 35개 통과
5. **E2E 검증** — 풀스크린 진입, 구조물 선택/제약 설정, 금지 영역 그리기, 탐색 시작→진행→완료 전체 플로우 확인

### 검증 결과

| 검증 | 결과 |
|---|---|
| `pnpm --filter @hwalro/frontend lint` | ✅ 통과 |
| `pnpm --filter @hwalro/frontend build` | ✅ 통과 (청크 크기 경고만) |
| `pnpm --filter @hwalro/frontend test` | ✅ 108개 통과 (happy-dom unhandled error는 사전 존재) |
| `simulation-service gradlew compileJava` | ✅ 통과 |
| `engine pytest` (전체) | ✅ 187 passed, 4 skipped |
| `engine test_constraints_edgecases.py` | ✅ 35 passed |

## 재개 시 할 일

아직 남은 확인 항목:

1. **"새로 탐색 → 제약 설정 다시 열기" 동작 브라우저 재확인**
   - `resetToSetup` + `SearchProgressHeader` "제약 설정 다시 열기" 버튼이 추가된 커밋(`3bbe941`) 이후
     브라우저 재검증이 필요 (탐색 완료 화면 → 제약 설정 화면 복귀)
2. **제약 조건을 실제로 설정한 상태로 탐색 시작** — constraints가 DB(`layout_searches.constraints` JSON)와
   엔진 입력에 제대로 전달되는지 확인
3. **25+ 제약조건 케이스의 브라우저 레벨 검증** — API 레벨(엔진 35개)은 완료, UI 레벨 반복 검증은 일부만 완료
4. **거부 버튼(후보 reject) 플로우** — `rejectCandidate` 시그니처 변경(`budget` 제거) 후 동작 확인
5. **spotlessCheck** — 내가 수정한 파일 3개는 통과했지만 `SimulationEngineRunner`/`CandidateTrialService`/
   `LayoutSearchOrchestrator`는 **기존(pre-existing) 포맷 위반**이 있어 전체 `spotlessCheck`는 실패 상태.
   원복해뒀으므로 이슈로 남아 있음.

## 환경 재구성 방법

```powershell
# 1. 인프라 (MySQL:3307, Redis:6380)
pnpm reset   # 볼륨 삭제 후 재생성 (스키마 변경 반영)

# 2. 백엔드 3개 (JWT_SECRET 필요!)
# auth-service (8080)
cd apps/auth-service; $env:JWT_SECRET="dev-only-secret-key-change-me-in-production-0123456789abcdef"; gradlew.bat bootRun
# simulation-service (8081)
cd apps/simulation-service; $env:JWT_SECRET="dev-only-secret-key-change-me-in-production-0123456789abcdef"; gradlew.bat bootRun
# regulation-service (8082)
cd apps/regulation-service; $env:JWT_SECRET="dev-only-secret-key-change-me-in-production-0123456789abcdef"; gradlew.bat bootRun

# 3. 프론트 (4173)
cd apps/frontend; pnpm run dev
```

로그인: `test` / `1234` (dml.sql bcrypt 해시 — `test`/`test` 아님!)

## E2E 데이터 준비 (DB 리셋 후 필요)

시뮬레이션은 **COMPLETED 상태**여야 배치 개선안 탐색이 가능합니다.

1. `POST /api/auth/login` → access token
2. `POST /api/drawings` `{ "title": "E2E", "withDefaultData": true }` → layoutVersionId 취득
3. `POST /api/simulations/drafts` `{ "layoutVersionId": <id>, "parentSimulationId": null }`
4. setup에 에이전트 배치(0.3m 반경/0.6m 간격 충족) + 출입구 선택 후 `PUT /api/simulations/:id/setup`
   - 유효 좌표 생성 스크립트: `%TEMP%\opencode\gen-agents2.cjs` (drawing.json 필요)
5. `POST /api/simulations/:id/execute` → COMPLETED 대기
6. 브라우저 `http://localhost:4173/simulations/:id/layout-search`
