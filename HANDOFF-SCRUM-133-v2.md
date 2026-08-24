# 인계 v2: Zone 편집 Figma 모델 구현 완료 · 후속 피드백 대기

작성 2026-08-24 · 브랜치 `feat/SCRUM-133` · 이전 문서: `HANDOFF-SCRUM-133-zone-editor.md`(플랜 전문은 부록으로 여기에 있음)

---

## 0. 30초 요약

이전 인계 문서의 설계 플랜(§1–§9 전부)을 **구현·검증까지 마쳤다**. 대체 비상구 제거, `layout_zone_members` 신설, 벽·기둥 ID 안정화, display_order, 캔버스 Zone 선택/이동/리사이즈, 계층 패널 DnD, 다중선택→구역 생성까지 전부 반영됐고 커밋됐다.

**다음 담당자가 할 일: 아래 §2의 사용자 후속 피드백 처리.**

---

## 1. 현재 상태 (검증 근거 포함)

| 영역 | 상태 |
|---|---|
| 프론트 | `lint` ✅ `build` ✅ `test` 155/155 ✅ |
| 백엔드 | `spotlessCheck` ✅, `test` 284중 실패 3건 = **기존 CandidateSelectorTest 고장**(이번 변경 무관, 건드리지 말 것), 21 skip = Testcontainers 환경 문제(기존) |
| 엔진 | pytest 289 passed |
| DDL | `deploy/init-db/02-simulation-schema.sql` ↔ `db/schema.sql` diff 빈 출력. mysql:8.4 실측(CHECK/UNIQUE/FK/CASCADE) 통과 |

주요 산출물: `layout_zone_members` 테이블(종류별 nullable FK + exactly-one CHECK), `display_order`(walls/pillars/fabrics/layout_zones), `ZoneElementKind`/`LayoutZoneMember`/`ZoneMemberDto`, `syncWalls/syncPillars`, `zoneGeometry.ts`, `LayerContextMenu.tsx`.

### 이번에 만든 동작 (수동 확인 리스트)

1. Select 도구로 Zone 클릭 → 선택되고 오른쪽에 속성 표시
2. 구조물 위에 Zone 그리기/드래그 → 거부되지 않음
3. Zone 모서리 핸들 리사이즈 → 저장 후 유지
4. 왼쪽 패널에 벽·기둥·구조물·Zone 행 표시, 패널↔캔버스 선택 하이라이트 연동
5. 패널 드래그로 소속 변경/빼기/같은 종류 재정렬/Zone 순서 교환, 새로고침 후 유지
6. Ctrl/Shift+클릭 다중 선택 → 우클릭 "선택 요소를 구역으로 묶기"
7. 도면 저장 후 새로고침 → 소속·순서 유지(ID 안정화 회귀 없음)

---

## 2. 🔴 다음 담당자가 처리할 것: 사용자 후속 피드백

사용자가 구현 결과를 보고 **추가 피드백을 주었다. 지금까지 전달된 것:**

1. **선택 도구로 벽 등 요소를 캔버스에서 선택하면 왼쪽 패널에서도 해당 행이 자동으로 선택(하이라이트)되어야 한다.** 패널→캔버스 방향은 되는데, 캔버스→패널이 체감상 안 된다는 보고다.
   - 참고: 코드상 패널 행은 `selection.*Ids`를 보고 하이라이트한다(`LayersPanel.tsx` Row `selected`). **먼저 실제로 재현부터 할 것.** 재현되면 원인 추정: (a) 구역에 속한 행이 긴 목록 아래로 가서 화면에 안 보임 → 선택 시 `scrollIntoView` 필요, (b) `selectAt` additive 토글로 반전돼 보이는 케이스, (c) `onSelectZone(null)` 호출 타이밍으로 패널 포커스가 날아가는 케이스.
   - Figma처럼: 캔버스 선택 → 패널 행 하이라이트 + **목록 스크롤이 따라간다**. 이 두 가지를 맞춰라.
2. **"등등.. 많긴 한데"** — 사용자가 추가 피드백을 더 갖고 있으나 아직 목록을 안 줬다. **작업 시작 전에 사용자에게 전체 피드백 목록을 먼저 요청할 것.** 임의로 범위를 추측하지 말 것.

사용자 제약(재확인): 기존 아키텍처·컨벤션 유지, 에디터의 관련 없는 부분 재설계 금지.

---

## 3. 구현 전 알아야 할 함정 (전부 계승 — 새 문서 읽기 전 이것만이라도)

1. **프론트·백엔드는 한 번에 배포/커밋.** 백엔드만 나가면 매 저장마다 FK CASCADE가 소속을 전부 지우고 200을 돌려준다.
2. **벽·기둥·구조물 id는 서로 겹친다**(독립 AUTO_INCREMENT). 멤버십 맵은 반드시 `(kind, id)` 키. 회귀 테스트 `wallMembershipWithTheSameNumericIdNeverAttachesToStructureConstraints`가 지켜준다.
3. **정렬 불변식**: `find{Walls,Pillars,Fabrics}{,Ids}ByVersionId` + `copyWalls/copyPillars`는 전부 `ORDER BY display_order ASC, id ASC`. 하나만 어겨도 소속이 조용히 엉뚱한 곳에 붙는다. (`findLayoutExitIdsByVersionId`만 예외 — `ORDER BY id ASC`)
4. Java record 위치 인자 함정: DTO 필드 제거/추가 시 **모든 생성 지점** 수동 확인(TS와 달리 컴파일이 못 잡는다).
5. `nullifyZoneExitReferences`는 런타임 지뢰 — 비상구 삭제 경로 수정 시 반드시 확인.

## 4. 환경 게이트 (그대로 계승)

```bash
pnpm --filter @hwalro/frontend lint && pnpm --filter @hwalro/frontend build && pnpm --filter @hwalro/frontend test
cd apps/simulation-service && ./gradlew.bat spotlessCheck test
diff deploy/init-db/02-simulation-schema.sql apps/simulation-service/src/main/resources/db/schema.sql  # 빈 출력
apps/simulation-service/engine/.venv/Scripts/python.exe -m pytest -q
```

- Testcontainers는 이 환경에서 skip → DDL은 `docker run mysql:8.4` 실측. **skip을 pass로 보고하지 말 것.**
- `CandidateSelectorTest` 3건 실패는 기존 문제. 건드리지 말 것.
- `pnpm --filter @hwalro/frontend format` 전역 실행 금지(파일 180개 재포맷). 파일 단위 `npx prettier --write`.
- PowerShell에서 파일 내용 읽고/쓰는 원라이너 금지 — 인코딩이 깨진다(실제로 한 번 사고 남). Edit/Write 도구 사용.
- **dev DB(`hwalro-mysql`:3307)에 새 스키마가 아직 미적용 상태.** `pnpm reset`(백업 후) 또는 델타 ALTER 중 선택해 사용자 승인을 받아 적용할 것. 미적용 상태로 실행하면 구역 저장이 FK 오류로 실패한다.
