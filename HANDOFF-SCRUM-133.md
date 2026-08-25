# 인계: SCRUM-133 구역 기능

대피 동선 엔진 단일화와 3D의 19개 후속 작업 현황은
`HANDOFF-SCRUM-133-EVACUATION-ROADMAP.md`에서 관리한다. 해당 작업을 수행할 때는 그 문서를
매번 함께 갱신한다.

브랜치 `feat/SCRUM-133` · 기준 커밋 `2c94a46` · dev 대비 35커밋 · 원격 푸시 완료

이 문서 하나가 현행 인계 문서다. 이전의 `HANDOFF-SCRUM-133-zone-editor.md`,
`HANDOFF-SCRUM-133-v2.md`는 내용이 낡아 삭제했다.

---

## 0. 30초 요약

도면에 "구역" 개념을 넣고, 그 위에 일반 직원·안전 담당자 기능을 얹는 작업이다.
구역 편집기(Figma 계층 모델), 배치 개선안의 도면 종속 제약, 대피 동선 A* 계산까지
구현·검증이 끝났다. dev 머지도 마쳤다.

**지금 멈춰 있는 지점: 사용자가 도면 2(더현대 지하 2층)의 구역 65개를 손으로
검수하는 중이다.** 검수가 끝나면 그 저장본을 기본 도면 데이터로 내보내는 작업이
다음 차례다. §2를 보라.

---

## 1. 현재 상태

| 영역 | 상태 |
|---|---|
| 프론트 | `lint` ✅ `build` ✅ `test` 200/200 ✅ |
| 백엔드 | `spotlessCheck` ✅ `test` 전체 통과 ✅ (오래 실패하던 `CandidateSelectorTest` 3건도 고쳐 이제 실패 0) |
| DDL | `deploy/init-db/02-simulation-schema.sql` ↔ `apps/simulation-service/src/main/resources/db/schema.sql` diff 빈 출력 |
| dev DB | 도면 2의 현재 버전 = 7, 구역 67개(자동 생성 65 + 사용자 원본 2) |

### 이번 브랜치가 만든 것

**구역 편집 (도면 편집기)**
- `layout_zone_members` — 종류별 nullable FK + exactly-one CHECK. 벽·기둥·구조물의 ID가
  서로 겹치므로 멤버십 키는 반드시 `(kind, id)`다.
- 계층 패널(`LayersPanel.tsx`, `LayerTreeRow.tsx`) — 드래그로 소속·순서 변경, 종류 아이콘,
  가장자리 자동 스크롤, 캔버스/패널 양방향 선택 동기화.
- 구역 유형에 `EXCLUSION` 추가. 배치 개선안 탐색이 피해야 할 영역을 별도 사각형 편집기 없이
  구역으로 표현한다. 평행 서브시스템이던 `layout_placement_exclusions`는 테이블까지 삭제했다.

**단일 순서 축**
- `display_order`가 종류별 인덱스가 아니라 **도면 버전 전체의 단일 순서**다. 벽을 구조물 위로
  올리는 배치가 가능하다. 캔버스 렌더와 히트테스트가 같은 병합 순서를 쓴다.
- 프론트는 저장 시 **모든** 요소의 순서를 확정해 보낸다(`serialization.ts`). 일부만 비우면
  서버가 종류별 인덱스로 폴백해 다른 종류의 값과 충돌한다.

**대피 동선 (A*)**
- `EvacuationGrid` — 도면을 0.25m 격자로. 각 칸에 가장 가까운 장애물까지의 거리(여유폭)를 담는다.
- `EvacuationRoutePlanner` — A*. 통로가 좁을수록 통행 비용을 최대 3배까지 올려 병목을 피한다.
  사람이 못 지나가는 폭은 길로 세지 않는다.
- 배정 비상구가 있으면 그곳으로, 없으면 **걸어서** 가장 가까운 곳으로(직선거리 아님).
- 시뮬레이션 엔진을 부르지 않는다. 680×400 격자에서 격자 생성 + 탐색 105ms.

**화면**
- `/my-zones`, `/my-zones/:zoneId/evacuation` — 일반 직원.
- `/drawings/:drawingId/evacuation-routes` — 안전 담당자용 도면 전체 동선 검토
  (`zones.evacuation.all` 권한). 도면 목록 행의 "대피 동선" 버튼으로 들어간다.

---

## 2. 다음 작업: 기본 도면으로 내보내기

### 지금까지의 경위

도면의 매장 이름 65개가 `layout_texts`에 좌표와 함께 이미 들어 있었다. 그래서 손으로 65개를
그리는 대신 기계로 초안을 만들었다 — 각 매장 텍스트에서 상하좌우로 광선을 쏴 벽에 막히는 지점을
경계로 잡고, 이웃 매장 점을 삼키지 않도록 중간에서 잘랐다. 겹침 0건으로 65개가 생성됐고 도면 2에
들어가 있다.

**사용자가 이것을 에디터에서 손으로 정답에 가깝게 고치는 중이다.** 자동 생성이라 특히 이런 게
틀려 있다: 이웃 텍스트가 없어 벽까지 크게 번진 구역(ARKET 433m², 나이키 라이즈 334m²), 통로를
반씩 나눠 가진 경계.

### 사용자가 "검수 끝났다"고 하면 할 일

1. 도면 2의 현재 버전을 통째로 읽는다(기하 + 구역 + 소속 + 구조물 제약).
2. `apps/simulation-service/src/main/resources/drawings/default-drawing-v8.json`을 대체할
   새 기본 도면 데이터를 만든다. **구역만 가져오지 말고 도면 전체를 다시 내보낸다** —
   검수 중 사용자가 벽이나 기물을 고쳤어도 어긋나지 않게 하기 위함이다.
3. `DefaultDrawingData`에 구역 그릇이 없다. `DefaultZone`(멤버는 배열 인덱스 참조) 레코드를
   추가하고, `DrawingService.create()`가 요소 삽입 후 구역·멤버십까지 만들도록 심는다.
   삽입 후 `find{Walls,Pillars,Fabrics}IdsByVersionId`로 다시 읽어 위치로 짝지으면 된다 —
   `carryLayoutMetadataForward()`가 이미 같은 방식을 쓴다.

사용자와 합의된 방향이다. 임의로 바꾸지 말 것.

---

## 3. 밟으면 조용히 깨지는 함정

1. **저장은 새 도면 버전을 만든다.** dev의 버전 히스토리 기능과 이 브랜치의 구역 기능이
   충돌했고, 사용자 결정으로 "버전 생성 유지 + 구역 이월"로 정리했다
   (`DrawingService.carryLayoutMetadataForward`). 요소는 새 ID로 다시 삽입되고, 구역·멤버십·
   구조물 제약이 **위치 기준 ID 맵**으로 이월된다.
   - 전제: 요청 배열 순서 == `find*IdsByVersionId`가 돌려주는 순서(`display_order ASC, id ASC`).
     이 불변식이 깨지면 소속이 **조용히 엉뚱한 요소에 붙는다**. 개수가 어긋나면 예외로 멈추게
     해뒀지만 순서가 어긋나는 것은 못 잡는다.
   - **구조물 제약은 저장 요청에 실려 오지 않는다.** 따로 이월하지 않으면 저장할 때마다
     기본값으로 리셋된다(`carryFabricConstraintsForward`).
2. **저장 후 프론트는 구역 메타데이터를 다시 읽어야 한다.** 요소는 새 ID를 받는데 화면이 이전
   버전의 구역 정보를 들고 있으면 짝이 하나도 안 맞아 **모든 요소가 공통 영역으로 빠진 것처럼
   보인다.** 데이터는 멀쩡한데 화면만 비는, 더 나쁜 종류의 버그다. `adoptSavedDrawing()` 하나로
   묶어뒀으니 한쪽만 부르지 말 것.
3. **벽·기둥·구조물 ID는 서로 겹친다**(독립 AUTO_INCREMENT). 멤버십 맵은 반드시 `(kind, id)` 키.
   회귀 테스트 `wallMembershipWithTheSameNumericIdNeverAttachesToStructureConstraints`가 지킨다.
4. **Java record 위치 인자.** DTO에 필드를 더하면 모든 생성 지점을 손으로 고쳐야 한다.
   dev 머지 때 이걸로 세 파일이 깨졌다.
5. **여유폭 계산을 우선순위 없는 완화 반복으로 되돌리지 말 것.** 27만 칸에서 몇 분씩 걸린다.
   지금은 chamfer 거리 변환(앞뒤 2회 스윕)이고 `EvacuationGridPerformanceTest`가 회귀를 잡는다.
6. **구역 크기 실행취소 이력은 저장 시점에 무효가 된다.** 이력이 이전 버전의 구역 ID를 들고 있어
   저장 후 되돌리기를 누르면 없는 구역을 고치려 한다. 지금은 404가 조용히 무시된다.
   **알려진 미수정 결함이다.** 저장 시 이력을 비우는 게 맞다.

---

## 4. 환경

```bash
pnpm --filter @hwalro/frontend lint && pnpm --filter @hwalro/frontend build && pnpm --filter @hwalro/frontend test
cd apps/simulation-service && ./gradlew.bat spotlessApply && ./gradlew.bat test
diff deploy/init-db/02-simulation-schema.sql apps/simulation-service/src/main/resources/db/schema.sql  # 빈 출력이어야 한다
```

- 서비스 포트: auth 8080 / simulation 8081 / regulation 8082. 프론트 dev는 4173(사용 중이면 4174).
- **백엔드를 고쳤으면 재시작해야 화면에 반영된다.** 프론트만 고쳤으면 HMR로 충분하다.
- dev 계정: `test` / `1234` (OPERATOR + SAFETY_REVIEWER), `employee` (GENERAL_EMPLOYEE).
- Testcontainers는 이 환경에서 skip된다. **skip을 pass로 보고하지 말 것.** DDL은
  `docker run mysql:8.4`로 실측하라.
- `pnpm --filter @hwalro/frontend format`을 디렉터리 단위로 돌리지 말 것. 무관한 파일 수십 개가
  재포맷된다(실제로 한 번 사고 냈고 26개를 되돌렸다). 파일 단위 `npx prettier --write`만 쓴다.
- PowerShell 원라이너로 파일을 읽고 쓰면 한글 인코딩이 깨진다. Read/Write/Edit 도구를 쓸 것.

---

## 5. 일부러 하지 않은 것

- **밀집도 거부권 완화.** 개선안 판정은 총 대피시간·평균 대피시간·최대 밀집도 중 하나라도
  여유치를 넘어 좋아지면 개선으로 본다. 단 밀집도는 비율이 아니라 **시스템 공통 안전 기준**
  (`density_threshold_settings`, 현재 3.0 person/m²)으로 판단해, 기준을 넘긴 채 나빠지면 아무리
  빨라져도 거부한다. 기준을 바꾸고 싶으면 코드가 아니라 그 설정을 바꾸면 된다.
- **"구역" 이름 충돌.** 시뮬레이션 결과의 "위험 구역"과 도면의 "구역"이 UI에서 같은 단어를 쓴다.
  지금은 문맥이 달라 견딜 만하지만 구역이 65개가 되면 혼란 가능성이 있다.
- **대피 경로 캐시.** 조회마다 격자를 새로 만든다. 105ms라 문제가 확인되기 전에는 넣지 않는다.
- **벽의 구역 소속.** 자동 배정에서 벽은 제외했다. 두 매장이 공유하는 경계라 한쪽에 붙이면
  반대쪽이 억울해진다. 필요하면 사람이 계층 패널에서 끌어 넣는다.
