# 인계: Zone 편집 경험을 Figma Frame/Layers 모델에 맞추기

작성 2026-08-24 · 브랜치 `feat/SCRUM-133` · 상태 **설계 완료, 구현 0%**

---

## 0. 30초 요약

지난 세션에서 Zone(구역) 기능을 17개 태스크로 구현해 커밋까지 끝냈다(`09ccf91` 까지). 사용자가 그 결과를 써보고 **피드백 6건**을 줬고, 그걸 반영하는 **설계 플랜만** 작성한 상태다. 코드는 한 줄도 바뀌지 않았고 작업 트리는 깨끗하다.

**다음 담당자가 할 일: 플랜대로 구현.**

- 플랜: 아래 **부록** — 이 문서보다 훨씬 상세하다. **구현 전에 반드시 통독할 것.**
- 이 문서는 그 플랜을 읽기 위한 맥락과, 플랜에 안 적힌 "왜 이렇게 결정했나"만 담는다.

---

## 1. 사용자 피드백 6건 (원문 요지)

| # | 요구 | 플랜 절 |
|---|---|---|
| 1 | Zone을 Select 도구로 캔버스에서 선택할 수 있어야 한다. **Zone 전용 우회로 말고** hit-test/selection 우선순위를 일관되게 고칠 것 | §1 |
| 2 | Zone은 자유롭게 이동 가능해야 한다. Zone은 "논리적 영역이지 물리적 장애물이 아니다" — 충돌·배치 제한 제거, 겹침 허용 | §2 |
| 3 | 왼쪽 계층 패널에 벽·기둥·구조물·Zone이 모두 보여야 한다 (지금은 구조물만) | §3 |
| 4 | 소속 변경은 왼쪽 패널 **드래그 앤 드롭**으로. 오른쪽 패널의 "이 구역에 넣기/빼기" 버튼은 **제거**. 오른쪽은 속성 편집만 | §4 |
| 5 | 다중 선택(Ctrl+클릭) → "선택 요소를 구역으로 묶기". 대상은 벽·기둥·구조물, **비상구 제외**. 바운딩 박스 자동 계산. 생성 후 Zone이 자식을 따라가지는 **않는다** | §5, §6 |
| 6 | 대체 비상구를 **완전히 제거**. 다른 fallback-exit 개념으로 대체하지 말 것 | §7 |

사용자가 명시한 제약(반드시 지킬 것):

> "Before changing code, inspect the current implementation and **preserve existing architecture and conventions** where possible. **Do not redesign unrelated parts of the editor.**"

---

## 2. 사용자가 답한 범위 결정 4건

플랜 작성 중 AskUserQuestion으로 확인받았다. 재논의 대상이 아니다.

1. **멤버십을 벽·기둥까지 확장하고, ID를 안정화한다.** 지금 도면 저장은 벽·기둥을 통째로 지우고 다시 넣으므로 그대로 두면 저장할 때마다 소속이 사라진다.
2. **표시 순서를 저장한다** (`display_order` 컬럼).
3. **Zone을 옮겨도 자식은 안 움직인다.**
4. **Zone 중첩(nesting)은 없다.** 1단계 유지.

---

## 3. 구현 전에 알아야 할 함정 (플랜 §9 요약)

플랜 §9에 8건이 있다. **1~3번은 예외 없이 조용히 데이터를 망가뜨린다.** 전문을 읽을 것.

1. **프론트·백엔드를 한 커밋/한 배포로.** 백엔드만 나가면 프론트가 벽·기둥 id를 안 보내므로 sync가 전부 "삭제됨"으로 판정 → FK CASCADE가 모든 소속을 지우고 **200을 반환한다.**
2. **벽·기둥·구조물 id는 서로 겹친다** (독립 AUTO_INCREMENT). 요소 id만으로 키를 만드는 맵은 전부 `(kind, id)`로 키를 줄 것. 실제 위험 지점: `LayoutMetadataService.readMetadata`의 `zoneIdByFabric`, 프론트 `zoneMembership.ts`.
3. **정렬 불변식.** `CandidateAdoptionService.idMapByOrder`가 리스트 위치로 id를 짝짓는다. `display_order` 도입 시 관련 8개 쿼리가 **전부** `ORDER BY display_order ASC, id ASC` 여야 한다. 하나라도 빠지면 소속이 엉뚱한 요소에 붙고 예외는 안 난다.

이 3건은 백그라운드 스키마 설계 에이전트가 잡아낸 것으로, 원래 초안에는 각각 반대로 적혀 있었다.

---

## 4. 구현 순서 (플랜 "실행 순서")

1. 대체 비상구 제거 (§7) — 독립적, 순감소. 먼저 치운다
2. 스키마 (§8.1, §8.2) — `layout_zone_members` 신설, `display_order` 추가
3. 벽·기둥 ID 안정화 (§8.3) — **백엔드+프론트 한 커밋**
4. 멤버십 DTO/서비스 교체 (§8.1, §8.4)
5. 캔버스 선택 + 충돌 면제 (§1, §2) — 프론트 단독, 3~4와 병행 가능
6. 계층 패널 (§3) → DnD (§4) → 그룹화 (§5, §6)

3번은 4번보다 **반드시** 먼저다.

---

## 5. 환경·게이트

```bash
pnpm --filter @hwalro/frontend lint && pnpm --filter @hwalro/frontend build && pnpm --filter @hwalro/frontend test
cd apps/simulation-service && ./gradlew.bat spotlessApply spotlessCheck test
diff deploy/init-db/02-simulation-schema.sql apps/simulation-service/src/main/resources/db/schema.sql  # 빈 출력이어야 함
```

지난 세션에서 겪은 것들:

- **Testcontainers가 이 환경에서 조용히 skip된다** (`tests=4 skipped=4`). Docker는 돌고 있는데도 그렇고, `SimulationSchemaIntegrationTest`도 마찬가지라 기존 문제다. DDL 검증은 `docker run mysql:8.4`로 직접 붙어서 실측할 것. **skip을 pass로 보고하지 말 것.**
- **`pnpm --filter @hwalro/frontend format` 쓰지 말 것.** `prettier --write "src/**"`라서 안 건드린 파일 180개를 줄바꿈만 바꿔 재포맷한다. 특정 파일만 `npx prettier --write <파일>`.
- **`CandidateSelectorTest` 3건 실패는 기존 문제다.** 내 변경과 무관함을 확인했다(`CandidateSelector.java`가 `2c610ff` 이후 미변경). 건드리지 말 것.
- **dev DB(`hwalro-mysql`, 포트 3307)에 마이그레이션을 사용자 승인 없이 적용하지 말 것.** 이미 옛 마이그레이션을 실행한 상태라 파일 제자리 수정 시 재실행이 불가능하다(플랜 §9-8).
- Bash 도구에서 heredoc이 자주 깨졌다. 긴 스크립트는 스크래치패드에 파일로 쓰고 경로로 실행하는 편이 낫다.

---

## 6. 마지막에 사용자에게 보고할 것

사용자가 구현 후 **8항목 요약**을 요청했다: 캔버스 선택 / Zone 이동 / 계층 패널 / DnD / 다중선택→Zone / 바운딩 박스 계산 / 대체 비상구 제거 / 테스트.

---

# 부록: 설계 플랜 전문


## Context

지난 작업에서 Zone(구역)을 도입했지만, 편집 경험이 Figma의 Frame/Section + Layers 모델과 어긋난다. 사용자 피드백 6건의 근본 원인을 코드에서 확인했다.

- **Zone을 캔버스에서 선택할 수 없다.** `hitTestElements`(`utils/hitTest.ts:117`)에 zone 개념이 아예 없고, `ZoneView`는 `<Group listening={false}>`(`LayoutCanvas.tsx:68`)로 그려진다. Zone 선택은 `LayoutPage.tsx:81`의 `useState<number|null>`이며 왼쪽 패널 클릭으로만 바뀐다.
- **Zone이 물리 충돌 규칙에 걸린다.** `zoneStart`→`applyRectDraftStart`(`editorReducer.ts:212-218`)가 `isInsideObstacleRect`로 "기둥이나 구조물 안에는 배치할 수 없습니다"를 띄우고, `zoneUpdate`→`applyRectDraftUpdate`(`editorReducer.ts:245`)가 `clampRectDraft`로 사각형을 잘라낸다. 즉 **기존 구조물 위에는 Zone을 그릴 수조차 없다.** Zone은 논리적 영역이지 장애물이 아니므로 잘못된 동작이다.
- **왼쪽 패널이 계층이 아니다.** `LayersPanel.tsx:165-185`에서 벽·외각벽·기둥·텍스트는 클릭 불가능한 **개수 표시**일 뿐이고, 행이 있는 건 구조물·비상구·구역뿐이다.
- **소속 관리가 오른쪽 패널 버튼이다.** `ZonePanel.tsx:237-245`의 "…이 구역에 넣기/빼기" 버튼이 유일한 수단이고, 한 번에 구조물 하나만 처리한다.
- **다중 선택 → Zone 생성 경로가 없다.**
- **대체 비상구가 있다.** 24개 파일 77줄에 걸쳐 있고, "기본과 달라야 한다" 규칙이 DDL CHECK·서비스·프론트 필터·테스트 **4곳에 중복** 구현되어 있다.

목표는 Zone을 **추상 컨테이너**로 만드는 것이다: 캔버스에서 자연스럽게 선택·이동되고, 충돌 대상이 아니며, 소속은 왼쪽 계층 패널의 드래그로 정하고, 오른쪽 패널은 속성만 편집한다.

### 승인된 범위 결정 (사용자 확인 완료)

1. **벽·기둥까지 ID 안정화를 확장한다.** 지금 도면 저장은 벽·기둥을 통째로 지우고 다시 넣으므로(`DrawingService.update()`의 `ponytail:` 주석 참조), 그대로 두면 저장할 때마다 소속이 사라진다. 구조물·비상구에 이미 적용한 identity-aware sync 패턴을 승급한다.
2. **표시 순서를 저장한다.** `display_order` 컬럼을 추가하고 저장 경로가 기록한다.
3. **Zone을 옮겨도 자식은 움직이지 않는다.** Zone은 "도면 위에 그려놓은 논리적 구획선"이다. 자식을 함께 옮기면 자식은 물리 객체라 충돌 검사를 받아야 하고, 막히는 순간 Zone과 자식이 어긋난다. 저장 경로도 둘로 갈라진다. 이 결정 덕분에 §2의 "Zone은 충돌하지 않는다"가 부작용 없이 성립한다.
4. **Zone 중첩(nesting)은 없다.** 1단계로 유지한다. 대피 경로·직원 배정·제약 투영이 모두 "직원 1명 = 구역 1개" 전제 위에 있어서, 중첩을 넣으면 상위 구역 담당자의 권한 범위 같은 새 인가 질문이 생긴다. 기존 PK `(layout_version_id, element)` = "한 요소는 한 Zone에만"도 그대로 간다.

---

## 1. 캔버스에서 Zone 선택 (피드백 1)

Zone 전용 우회로를 만들지 않고 **기존 hit-test/selection 파이프라인에 7번째 종류로 추가**한다.

### 선택 우선순위

`hitTestElements`는 첫 매치에서 반환한다(`hitTest.ts:127-200`). 현재 순서는 텍스트 → 구조물 → 기둥 → 비상구 → 벽 → 외각벽. **Zone을 맨 마지막에 넣는다.** 겹치는 자식이 항상 이기므로 피드백의 "selection behavior should coexist correctly with overlapping child objects"가 자연히 충족된다.

### 변경 지점

`hitTest.ts`는 `zones`를 마지막 인자로 받고 `ElementHit`에 `zoneId: string | null`을 추가한다. Zone은 `{x,y,width,height}`이고 회전이 없으므로, 기존 `hitTestRect(element: RectLike, ...)`(`hitTest.ts:90`)를 재사용하려면 `RectLike`로 변환하는 어댑터 하나면 된다:

```ts
// utils/zoneGeometry.ts (신규)
export function zoneAsRect(zone: LayoutZone): RectLike {
  return { startX: zone.rect.x, startY: zone.rect.y,
           endX: zone.rect.x + zone.rect.width,
           endY: zone.rect.y + zone.rect.height, rotation: 0 };
}
```

이 어댑터 하나로 `hitTestRect`(본체)와 `hitTestRectHandle`(`hitTest.ts:254`, 리사이즈 핸들)을 둘 다 재사용할 수 있다.

`ElementHit`에 필드가 하나 늘면 **탐색 결과상 8곳**을 함께 고쳐야 한다. 빠뜨리면 조용히 깨진다:

| 파일 | 위치 |
|---|---|
| `utils/hitTest.ts` | 인터페이스 + 7개 return 리터럴 전부 |
| `LayoutCanvas.tsx:167` | `hasHit` 술어 |
| `LayoutCanvas.tsx:438` | select 경로의 인라인 `if` (— `hitAt`을 재사용하도록 정리) |
| `LayoutCanvas.tsx:446-459` | `wasSelected` 체인 |
| `LayoutCanvas.tsx:460, :477` | `selectAt` dispatch 리터럴 2개 |
| `state/selection.ts:4-12` | `SelectAtAction` |
| `state/editorReducer.ts:69-78` | 액션 타입 |
| `LayersPanel.tsx:55-64, :149-158` | 패널의 dispatch |

`LayoutCanvas.tsx:428`의 select 경로는 지금 `hitAt`(`:152`)과 `hasHit`(`:167`)을 **인라인으로 중복**하고 있다. 종류를 추가하는 김에 `hitAt`/`hasHit`을 쓰도록 정리해 중복을 없앤다.

### Zone 선택 상태를 어디에 둘 것인가

**`PointSelection`에 `zoneIds: string[]`를 추가하지 않는다.** Zone은 서버 소유 상태이고 undo/redo 문서에 넣지 않기로 한 결정(`useLayoutMetadata.ts:21-26`)을 유지한다. 대신:

- `hitTestElements`는 `zoneId`를 돌려준다(캔버스 히트 판정용).
- `LayoutCanvas`는 zone 히트 시 `selectAt`을 **비우는 방향으로** dispatch하고(다른 종류 선택 해제) `onSelectZone(zoneId)`를 호출한다.
- 반대로 다른 요소를 선택하면 `onSelectZone(null)`.

즉 Zone 선택과 요소 선택은 상호 배타적이며, 이는 오른쪽 패널이 이미 그렇게 분기하고 있는 구조(`LayoutPage.tsx:508`, ZonePanel과 SettingsPanel이 상호 배타)와 일치한다.

`<Group listening={false}>`는 그대로 둔다 — Konva Stage 전체가 비활성이고 포인터 처리는 감싸는 `<div>`에서 하므로(`LayoutCanvas.tsx:600-611`) 이 속성은 선택과 무관하다.

---

## 2. Zone은 충돌하지 않는다 (피드백 2)

### 근본 원인과 수정

`applyRectDraftStart`/`applyRectDraftUpdate`가 기둥·구조물 드래프트와 **공유**되기 때문에 Zone도 충돌 규칙을 탄다. 두 함수에 옵션을 넘겨 Zone만 물리 규칙을 건너뛴다:

```ts
function applyRectDraftStart(state, point, collide = true) {
  if (collide && isInsideObstacleRect(point, state.doc)) { /* 기존 거부 경로 */ }
  ...
}
function applyRectDraftUpdate(state, point, collide = true) {
  ...
  const end = collide ? clampRectDraft(state.draft.start, snapped.point, state.doc) : snapped.point;
}
```

`case 'zoneStart'` / `case 'zoneUpdate'`(`editorReducer.ts:422-428`)만 `false`를 넘긴다. 기둥·구조물 경로는 완전히 그대로다.

### Zone 이동·리사이즈

Zone은 `DrawingDocument`에 없으므로 `dragStartMove`/`translateDoc`/`clampMoveDelta` 경로를 **타지 않는다** — 이것이 "충돌하지 않는다"를 자동으로 보장한다. 대신 `LayoutCanvas` 안에 `panRef`와 같은 방식의 로컬 드래그 세션을 둔다:

```ts
const zoneDragRef = useRef<{ zoneId: number; kind: 'move' | 'resize';
                            handle: RectHandle; origin: Vec2; originRect: ZoneRect } | null>(null);
const [zoneDraftRect, setZoneDraftRect] = useState<ZoneRect | null>(null);
```

- pointerdown: 리사이즈 핸들(`hitTestRectHandle` + `zoneAsRect`) → 본체 순으로 검사해 세션 시작
- pointermove: `zoneDraftRect` 갱신 → `ZoneView`가 저장된 rect 대신 이것을 그림
- pointerup: `onZoneRectCommit(zoneId, rect)` → `metadata.updateZone` (기존 낙관적 갱신 경로)

**충돌 검사 없음.** 다른 물리 객체도 Zone을 장애물로 보지 않는다 — `clampMoveDelta`(`collision.ts:257`)와 `rectObstacles`(`:145`)는 `doc.pillars`/`doc.fabrics`만 보므로 이미 그렇다. 변경 불필요.

`readOnly`(잠금 버전)는 Zone 드래그를 막지 **않는다** — 잠긴 버전에서도 구역 메타데이터는 수정 가능하다는 기존 결정을 유지한다. 대신 `canManageZones` 권한으로 막는다.

### 도면 경계

서버 `LayoutZoneService.applyRect`는 여전히 도면 범위 안을 요구한다(충돌이 아니라 경계 검증). 클라이언트도 드래그 결과를 도면 범위로 clamp해 저장 실패를 예방한다. 기존 `clampToDocBounds`(`drag.ts:12`) 재사용.

---

## 3. 왼쪽 계층 패널 (피드백 3)

`LayersPanel.tsx:165-185`의 개수 `<dl>`을 실제 행으로 대체한다. 표현 규칙:

| 그룹 | 내용 | Zone 소속 | 순서 변경 |
|---|---|---|---|
| **구역** | Zone 행 + 그 아래 들여쓴 자식(벽·기둥·구조물) | — | O |
| **공통** | 어떤 Zone에도 속하지 않은 벽·기둥·구조물 | O | O |
| **공용 시설** | 비상구, 외각벽, 텍스트 | X | X |

피드백의 "Exits may remain common infrastructure as previously designed"를 따라 비상구는 **보이지만 Zone에 넣을 수 없다**. 외각벽(건물 외피)과 텍스트도 같은 취급으로 일관성을 맞춘다.

행 종류를 아이콘/접두 라벨로 구분한다. `groupStructuresByZone`(`utils/zoneMembership.ts:21`)을 벽·기둥까지 다루도록 일반화한다.

---

## 4. 드래그 앤 드롭 소속 관리 (피드백 4)

### 기술 선택: 네이티브 HTML5 DnD

프론트엔드 전체에 DnD 구현도 라이브러리도 **없다**(`onDragStart`/`draggable`/`dataTransfer` 0건, package.json에 DnD 라이브러리 없음). 캔버스는 포인터 이벤트를 쓰지만 그건 캔버스라서다. **DOM 리스트의 재정렬/재부모화는 네이티브 HTML5 DnD가 정확히 그 용도**이므로 의존성을 추가하지 않고 `draggable` + `onDragOver` + `onDrop`을 쓴다.

### 드롭 대상과 동작

- Zone 행에 드롭 → 그 Zone의 자식으로 이동
- "공통" 그룹 헤더에 드롭 → Zone에서 빼기
- 같은 그룹 안 행 사이에 드롭 → 순서 변경
- 비상구/외각벽/텍스트 행은 `draggable={false}`이며 드롭 대상도 아님

### 접근성

HTML5 DnD는 키보드로 조작할 수 없다. AGENTS.md의 "접근 가능한 HTML 요소" 원칙을 지키기 위해 **각 행에 컨텍스트 메뉴를 붙이고 키보드로도 열 수 있게 한다**(우클릭 + 행의 `⋯` 버튼 + `Shift+F10`). 메뉴 항목: "구역으로 이동 ▸"(Zone 목록 + "구역에서 빼기"), "선택 요소를 구역으로 묶기". 이 메뉴는 피드백 5에도 필요하므로 이중으로 값을 한다.

프론트엔드에 컨텍스트 메뉴 컴포넌트가 없다(0건). `Modal`은 중앙 정렬이라 부적합하다. 패널 스타일(`LayersPanel.tsx:16-21`의 `rowClassName` 계열)에 맞춘 **작은 앵커드 메뉴**를 `features/layout/components/LayerContextMenu.tsx`로 새로 만든다. Escape/바깥 클릭 닫기, 포커스 복귀만 지원하고 그 이상 만들지 않는다.

### 오른쪽 패널에서 제거

`ZonePanel.tsx:222-247`의 "구성 구조물 N개" 블록과 `onToggleMembership` prop, `LayoutPage.tsx:557-566`의 핸들러를 **삭제**한다. 구성 요소 개수는 읽기 전용 표시로만 남긴다. 오른쪽 패널은 이름·유형·사각형·담당 직원·기본 비상구만 편집한다.

---

## 5. 다중 선택 → Zone 생성 (피드백 5)

### 다중 선택 제스처

`applySelectAt`(`selection.ts:14`)의 `additive`는 **종류별로 토글하되 다른 종류를 지우지 않는다**. 즉 종류를 넘나드는 다중 선택이 이미 가능하다. 현재 유일한 제스처는 `event.shiftKey`(`LayoutCanvas.tsx:468, :485`)다.

피드백은 Windows의 Ctrl+click을 언급하면서 "preserve any existing multi-select convention if one already exists"라고 했다. **둘 다 받는다**: `event.shiftKey || event.ctrlKey || event.metaKey`. Ctrl은 undo/redo에 쓰이지만 그건 keydown이라 pointerdown과 충돌하지 않는다.

함께 필요한 가드: `onPointerDown`에 `event.button !== 0` 검사를 추가해 우클릭이 선택·팬을 시작하지 않게 한다(컨텍스트 메뉴용).

`LayersPanel`의 행 클릭도 `additive`를 지원하도록 바꾼다(현재 `:63`, `:157`에서 `false` 하드코딩).

### 그룹화 동작

컨텍스트 메뉴의 "선택 요소를 구역으로 묶기"가 활성화되는 조건: 선택된 **벽·기둥·구조물**이 1개 이상이고 모두 저장된 요소(`backendId !== null`)일 것. 비상구·외각벽·텍스트는 선택에 포함되어 있어도 **무시**한다(피드백: "Do not include exits in a Zone").

실행 시:
1. 선택 요소들의 바운딩 박스 계산 (§6)
2. `createZone`으로 Zone 생성 — 이름은 `구역 N`, 유형 `WORK`, 소속 요소 목록 포함
3. 새 Zone을 선택 상태로 만들고 요소 선택은 해제

한 번의 API 호출로 끝난다(`ZoneCreateRequest`가 이미 소속 목록을 받는다).

---

## 6. 자동 바운딩 박스 (피드백 5)

회전 사각형의 AABB 유틸이 없다. 하지만 필요한 조각은 있다:

- `rectCorners(element)`(`collision.ts:149`) — **private**. 회전을 반영한 4개 코너를 이미 계산한다. `export`만 붙이면 된다. 새로 수학을 쓰지 않는다.
- `rotatePoint`, `rectCenter`(`geometry.ts:45, :57`)

```ts
// utils/zoneGeometry.ts (신규, §1의 zoneAsRect와 같은 파일)
export function boundingBoxOf(
  walls: Wall[], pillars: Pillar[], fabrics: Fabric[],
): ZoneRect | null {
  const points: Vec2[] = [
    ...walls.flatMap((w) => [{ x: w.startX, y: w.startY }, { x: w.endX, y: w.endY }]),
    ...pillars.flatMap(rectCorners),   // 회전 반영
    ...fabrics.flatMap(rectCorners),   // 회전 반영
  ];
  if (points.length === 0) return null;
  // min/max → {x, y, width, height}
}
```

벽은 선분이라 양 끝점이 곧 extent다. 기둥·구조물은 `rotation`이 있으므로 반드시 `rectCorners`를 거친다 — 피드백의 "Account for each element's actual geometry, including dimensions and rotation".

**패딩**: 상수 `ZONE_PADDING_METERS = 0.5` 하나. 결정론적이고, 적용 후 도면 범위로 clamp해 §2의 서버 검증에 걸리지 않게 한다.

**생성 후 Zone은 자식을 따라가지 않는다** — 바운딩 박스는 최초 생성에만 쓴다(피드백 명시). 이후 자유 이동·리사이즈 가능.

---

## 7. 대체 비상구 제거 (피드백 6)

**24개 파일 77줄.** 마이그레이션 파일은 git 미추적이고, 적용된 유일한 DB(로컬 dev)에 `alternate_exit_id`가 채워진 행이 **0개**다. 따라서 **후속 마이그레이션 없이 파일을 직접 수정**한다.

| 계층 | 제거 대상 |
|---|---|
| DDL ×3 (`schema.sql`, `deploy/init-db/02-simulation-schema.sql`, `migration-*.sql`) | `alternate_exit_id` 컬럼, `ck_layout_zones_alternate_differs`, `fk_layout_zones_alternate_exit`. 두 파일은 **바이트 동일** 유지 |
| Java 도메인 | `LayoutZone` 필드 + getter/setter, 클래스 Javadoc |
| Java DTO | `ZoneResponse`, `ZoneCreateRequest`, `ZoneUpdateRequest`(+`clearAlternateExit`), `MyZoneResponse`, `AssignedZoneRow`, `EvacuationRouteResponse` |
| Java 서비스 | `LayoutZoneService.applyExits` 대폭 축소, `LayoutMetadataService.toZoneResponse`/`toMyZone`, `EvacuationPreviewService`(7곳), `LayoutMetadataCopier:59` |
| MyBatis | `LayoutZoneMapper.xml`의 `zoneColumns`·`insertZone`·`updateZone`·`findAssignedZonesByUserId`(+`LEFT JOIN ae` 제거), `DrawingMapper.xml`의 `nullifyZoneExitReferences`에서 중복 `<foreach>` 하나 제거 |
| 프론트 | `layoutMetadataApi.ts`, `zoneApi.ts`, `ZonePanel.tsx:203-222`, `LayoutPage.tsx:541-556`(`which` 파라미터 자체가 사라져 삼항 2개 소멸), `MyZonesPage.tsx:88-93`, `EvacuationPage.tsx:102/198-203/263-268`(+`sm:grid-cols-3`→`2`) |

### 위험: Java record는 위치 기반이다

`ZoneCreateRequest`는 `assignedUserId`/`defaultExitId`/`alternateExitId`가 **연속된 `Long` 3개**다. 가운데를 빼면 인자가 밀리면서 **컴파일이 통과**한다. 모든 생성 지점을 명시적으로 확인해야 한다: `LayoutZoneServiceTest:65-67, 129-130, 139-140`, `LayoutZoneAuthorizationTest:190-200`, `EvacuationPreviewServiceTest`. TS 쪽은 초과 속성 검사가 즉시 잡아준다.

### 동작 변화 (기록할 것)

`EvacuationPreviewService`의 `selectedExitIds`가 항상 0개 또는 1개가 된다. 엔진이 "둘 중 나은 쪽"을 고르는 전제가 사라지고 `recommendedExitId`는 사실상 기본 비상구가 된다. 경로 waypoints를 얻는다는 목적은 그대로다.

"기본과 달라야 한다" 규칙 4중 구현(DDL CHECK / `applyExits:320-322` / `ZonePanel.tsx:215` 필터 / 테스트)이 한꺼번에 사라진다.

---

## 8. 백엔드: 소속 확장 + 표시 순서

### 8.1 멤버십 테이블: `layout_zone_members`, 종류별 nullable FK + "정확히 하나" CHECK

`(element_kind VARCHAR, element_id BIGINT)` 다형 참조는 채택하지 **않는다**. 이 스키마는 복합 FK로 버전 간 참조를 DB 수준에서 거부하는 것을 일관되게 쓰고 있고(`simulation_exits`, `layout_zones`→`layout_exits`, 현재의 `layout_zone_structures`→`fabrics`), 그 성질은 이미 테스트로 못박혀 있다(`LayoutZoneSchemaIntegrationTest.zoneCannotReferenceExitFromAnotherLayoutVersion`). 다형 참조는 그걸 앱 코드로 옮기고, 요소 삭제 시 고아 행 청소도 직접 해야 한다. 지금은 `ON DELETE CASCADE`가 공짜로 해준다.

**테이블 이름을 `layout_zone_members`로 바꾼다.** 이 코드베이스에서 "구조물/structure"는 fabric 전용 용어다(`StructureConstraintDto.fabricId`, `PATCH /structures/{fabricId}/constraints`). 벽까지 담는 테이블에 그 이름을 두면 영구적인 거짓말이 된다. 이 테이블을 참조하는 파일은 어차피 전부 이번에 고친다.

```sql
CREATE TABLE IF NOT EXISTS layout_zone_members (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    zone_id BIGINT UNSIGNED NOT NULL,
    -- 벽·기둥·구조물 중 정확히 하나만 채운다. 비상구·외각벽·텍스트는 구역 구성원이 아니다.
    wall_id BIGINT UNSIGNED NULL,
    pillar_id BIGINT UNSIGNED NULL,
    fabric_id BIGINT UNSIGNED NULL,
    CONSTRAINT pk_layout_zone_members PRIMARY KEY (id),
    -- 요소 하나는 구역 하나에만 속한다. 유니크 인덱스는 NULL 중복을 허용하므로
    -- 다른 종류의 행은 이 제약에 걸리지 않는다.
    -- 컬럼 순서를 아래 FK와 같게 둔다 - InnoDB는 FK 컬럼 순서와 좌측이 일치하는
    -- 인덱스만 재사용하므로, 뒤집어 선언하면 FK마다 그림자 인덱스가 하나씩 더 생긴다.
    CONSTRAINT uk_layout_zone_members_wall UNIQUE (wall_id, layout_version_id),
    CONSTRAINT uk_layout_zone_members_pillar UNIQUE (pillar_id, layout_version_id),
    CONSTRAINT uk_layout_zone_members_fabric UNIQUE (fabric_id, layout_version_id),
    CONSTRAINT ck_layout_zone_members_exactly_one
        CHECK ((wall_id IS NOT NULL) + (pillar_id IS NOT NULL) + (fabric_id IS NOT NULL) = 1),
    CONSTRAINT fk_layout_zone_members_zone
        FOREIGN KEY (zone_id, layout_version_id) REFERENCES layout_zones (id, layout_version_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    -- 요소가 지워지면 소속도 함께 사라진다. 복합 FK 컬럼 중 하나가 NULL이면
    -- InnoDB는 그 FK를 검사하지 않으므로 다른 종류의 행에는 영향이 없다.
    CONSTRAINT fk_layout_zone_members_wall
        FOREIGN KEY (wall_id, layout_version_id) REFERENCES walls (id, layout_version_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_layout_zone_members_pillar
        FOREIGN KEY (pillar_id, layout_version_id) REFERENCES pillars (id, layout_version_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_layout_zone_members_fabric
        FOREIGN KEY (fabric_id, layout_version_id) REFERENCES fabrics (id, layout_version_id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    INDEX idx_layout_zone_members_zone (zone_id, layout_version_id)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
```

기존 PK `(layout_version_id, fabric_id)`가 하던 "한 요소 = 한 Zone" 역할을 종류별 유니크 3개가 대신한다. nullable 컬럼은 PK에 못 들어가므로 대리 `id`를 쓴다 — `layout_placement_exclusions`와 같은 형태라 새 패턴이 아니다.

**DDL 순서**: `uk_walls_id_version`·`uk_pillars_id_version`이 `layout_zone_members`보다 먼저 존재해야 한다.

Java 쪽은 문자열이 경계를 넘어오지 않도록 enum을 둔다. `ZoneType.from`과 달리 **알 수 없는 값에 기본값을 주지 않고 던진다** — 모르는 kind는 클라이언트 버그다.

```java
public enum ZoneElementKind { WALL, PILLAR, FABRIC; public static ZoneElementKind from(String v) { /* throws */ } }
```

`ZoneMemberDto(String kind, Long id)`를 쓰고 `wallIds`/`pillarIds`/`fabricIds` 3중 배열은 쓰지 않는다. 후자는 `replaceMembers(versionId, zoneId, List<Long>, List<Long>, List<Long>)`가 되어 **같은 타입 리스트 3개를 바꿔 넘겨도 컴파일된다**. `(String, Long)`은 그럴 수 없다.

### 8.2 표시 순서는 요소 테이블에 두고, 도면 저장이 기록한다

`display_order INT NOT NULL DEFAULT 0`을 `walls`, `pillars`, `fabrics`, `layout_zones`에 추가한다. 멤버십 행이 아니라 **요소 테이블**에 두는 이유: 패널은 Zone 자식뿐 아니라 "공통" 그룹의 순서도 보여야 하는데, 멤버십에 두면 공통 요소는 순서를 가질 수 없다.

**순서 전용 엔드포인트는 만들지 않는다.** 도면 저장 요청은 이미 정렬된 배열을 통째로 보내므로 **배열 인덱스가 곧 순서**다. `toWalls`/`toPillars`/`toFabrics`가 `IntStream.range`로 인덱스를 `displayOrder`에 넣고, `updateWallGeometry`/`updatePillarGeometry`/`updateFabricGeometry`가 `display_order`를 SET에 포함한다. (제약 컬럼을 SET에서 제외하는 기존 규칙은 그대로 — `display_order`는 제약이 아니라 기하 쪽 소유다.)

Zone 순서만 예외로 `ZoneUpdateRequest.displayOrder`(메타데이터 PATCH)로 쓴다. Zone은 도면 저장 경로 자체가 없기 때문이다.

**알려진 동작(문서화 필요)**: 잠긴 도면 버전에서는 **소속 변경은 되지만 순서 변경은 안 된다.** 소속은 메타데이터 API, 순서는 도면 저장이기 때문이다. 패널은 잠금 상태에서 순서 드래그를 비활성화하고 이유를 표시한다.

조회는 전부 `ORDER BY display_order ASC, id ASC`(동률이면 id로 결정론 확보) — **§9 위험 3 참조. 이 규칙을 한 곳이라도 어기면 소속이 조용히 엉뚱한 요소에 붙는다.**

### 8.3 벽·기둥 ID 안정화

`syncFabrics`/`syncExits`(`DrawingService.java`)와 **같은 패턴**을 `syncWalls`/`syncPillars`로 복제한다. `validateRequestedIds`는 이미 종류 무관하게 쓰이도록 되어 있어 그대로 공유한다. `update()`의 `ponytail:` 주석은 이제 외각벽·텍스트에만 해당하도록 좁힌다.

- `WallDto`/`PillarDto`에 첫 컴포넌트로 `Long id` 추가 — `FabricDto`/`ExitDto`와 같은 형태
- 매퍼: `insertWall`/`insertPillar`(`useGeneratedKeys`), `findWallIdsByVersionId`/`findPillarIdsByVersionId`, `updateWallGeometry`/`updatePillarGeometry`, `deleteWallsByIds`/`deletePillarsByIds`
- 프론트 `Wall`/`Pillar`에 `backendId: number | null`, `SerializedWall`/`SerializedPillar`에 `id` — `serialization.ts`의 `toBackendId` 재사용. **주의**: `parseRects`는 기둥·구조물이 공유하는데 지금은 기둥에서 `backendId`를 명시적으로 버린다(`serialization.ts:318-327`). 그 제거를 되돌린다.

### 8.4 파급

- **`SearchConstraintProjector`**: 무영향. `fabrics`만 순회하며 벽·기둥에는 배치 제약 컬럼이 없다. `Map.copyOf`로 순서가 이미 사라지므로 `display_order` 정렬도 스냅샷 의미를 바꾸지 않는다. **파일 수정 없음.**
- **직원 소유 검사**: `findZoneIdByFabricId`는 `fabric_id` 컬럼을 그대로 쓰므로 **이름·시그니처 유지**. 벽·기둥 행은 `fabric_id IS NULL`이라 매치되지 않는다. `requireOwnedStructure`도 수정 없음.
- **`LayoutMetadataCopier.copy`**: 네 번째 인자를 **종류로 키를 준 맵**으로 받는다.
  ```java
  public void copy(Long sourceVersionId, Long targetVersionId,
                   Map<Long, Long> exitIdMap,
                   Map<ZoneElementKind, Map<Long, Long>> elementIdMaps)
  ```
  `Map<Long,Long>` 네 개를 나란히 받으면 순서를 바꿔 넘겨도 **컴파일러가 못 잡는다**. 이건 record 위치 인자보다 더 나쁘다. `remap`은 `elementIdMaps.get(kind)`가 null이어도 NPE 대신 명확히 실패하도록 가드를 둔다.
- **`DrawingService.duplicate()`**: 지금 벽·기둥은 배치 `insertWalls`/`insertPillars`라 ID를 못 받는다. `copyFabricsWithIdMap`과 같은 형태의 `copyWallsWithIdMap`/`copyPillarsWithIdMap`으로 바꾼다(§8.3의 단건 `insertWall`/`insertPillar`를 재사용하므로 새 SQL 없음). `copyFabricsWithIdMap`에도 `setDisplayOrder` 추가.
- **`CandidateAdoptionService`**: `idMapByOrder(source, target, boolean exits)`의 boolean 플래그는 네 종류로 확장되지 않는다. 리더 함수로 바꾼다 — `idMapByOrder(drawingMapper::findWallIdsByVersionId, source, target, "벽")`. `copyFabric`에 `setDisplayOrder` 추가: 빠뜨리면 채택된 배치가 전부 `display_order = 0`이 되어 정렬이 id 순으로 되돌아가고, **그 순서로 짝지은 ID 맵이 어긋난다**(§9 위험 3).
- **DTO 위치 인자**: `ZoneResponse.structureFabricIds: List<Long>` → `members: List<ZoneMemberDto>`. `ZoneUpdateRequest`도 동일 + `Integer displayOrder`. §7의 record 위치 인자 위험이 그대로 적용된다.
- **죽은 코드 정리**: `DrawingMapper.copyFabrics`는 Java 호출자가 **없다**(지난 작업에서 추가하고 배선하지 않음). 남겨두면 `display_order`를 복사하지 않는 함정이 되므로 XML과 함께 삭제한다. `deleteWallsByVersionId`/`deletePillarsByVersionId`도 sync 전환 후 죽는다.

## 9. 위험

구현 중 반드시 확인할 것들. 1~3은 조용히 데이터를 망가뜨린다.

1. **프론트·백엔드를 함께 배포해야 한다.** 백엔드는 `WallDto.id`를 받게 되지만 현재 프론트는 벽·기둥 id를 보내지 않는다(`serialization.ts`가 기둥 `backendId`를 **명시적으로 버린다**). 백엔드만 배포하면 매 저장마다 모든 벽·기둥이 `id == null` → `syncWalls`가 전부 "삭제됨"으로 판정 → `deleteWallsByIds` → **FK CASCADE가 모든 소속을 지우고 200을 반환한다.** 이번 변경에서 가장 위험한 항목.
2. **벽·기둥·구조물의 id는 서로 겹친다.** 독립 AUTO_INCREMENT라 벽 7번과 구조물 7번이 동시에 존재한다. 요소 id만으로 키를 만드는 맵은 전부 `(kind, id)`로 키를 주거나 종류로 걸러야 한다. 실제 발생 지점 둘: `LayoutMetadataService.readMetadata`의 `zoneIdByFabric`(거르지 않으면 **벽 7번의 구역이 구조물 7번의 제약에 붙고, 직원에게는 그게 가시성 필터다**), 프론트 `zoneMembership.ts`의 `zoneByFabricId`.
3. **정렬 불변식.** `CandidateAdoptionService.idMapByOrder`는 원본·대상 id를 **리스트 위치로** 짝짓는다. `display_order` 도입으로 삽입 순서가 바뀌므로, 아래 8개가 **전부** `ORDER BY display_order ASC, id ASC`여야 한다: `findWalls/Pillars/FabricsByVersionId`, `findWall/Pillar/FabricIdsByVersionId`, `copyWalls`, `copyPillars`. 한쪽만 `ORDER BY id`로 남으면 소속이 엉뚱한 요소에 붙는다 — 예외 없이, 잘못된 데이터만 남는다. `remap`의 fail-fast는 개수 불일치만 잡지 짝 어긋남은 못 잡는다. (`findLayoutExitIdsByVersionId`는 `ORDER BY id ASC` 유지 — 비상구는 display_order가 없어 양쪽이 일치한다.)
4. **`nullifyZoneExitReferences`는 런타임 지뢰다.** `DrawingMapper.xml`이 `alternate_exit_id`를 이름으로 참조한다. 컬럼만 지우고 이 문장을 안 고치면 컴파일·기동은 멀쩡하고 **사용자가 사용 중인 비상구를 지울 때** 터진다.
5. **`AssignedZoneRow`는 MyBatis 생성자 매핑이다.** SELECT 컬럼 순서와 record 컴포넌트 순서를 같은 편집에서 맞춰야 한다.
6. **`outside_walls`·`layout_texts`는 계속 delete-and-reinsert다.** 이들이 절대 Zone 구성원이 되지 않도록 `ZoneElementKind`에서 제외해 둔다. 나중에 누가 추가하려 하면 enum에서 막히고, 조용히 소속이 사라지는 일은 생기지 않는다.
7. **`syncExits`의 순서 보장.** 비상구 삭제 전 `nullifyZoneExitReferences` 호출은 `syncIdentities` 리팩터링 후에도 살아 있어야 한다. `DrawingServiceIdentitySyncTest.clearsZoneExitReferencesBeforeDeletingExits`가 `InOrder`로 지킨다.
8. **dev DB는 이미 옛 마이그레이션을 실행했다.** 파일을 제자리 수정하면 그 DB에서는 재실행이 불가능하다(`ADD COLUMN movable`이 실패). `db/schema.sql`로 재생성하거나 델타 ALTER를 따로 돌려야 한다. **사용자 승인 없이 dev DB를 건드리지 않는다.**

---

## 실행 순서

의존성이 있어 순서를 지켜야 한다.

1. **대체 비상구 제거 (§7)** — 독립적이고 순감소다. 먼저 치워 이후 작업의 DTO 위치 인자 혼란을 줄인다.
2. **스키마 (§8.1, §8.2)** — `ALTER walls/pillars`(유니크 키 + `display_order`) → `fabrics`/`layout_zones`에 `display_order` → `layout_zone_members` 생성 → 기존 `layout_zone_structures` 데이터 이관 후 DROP. `schema.sql`과 `deploy/init-db/02-simulation-schema.sql`을 **바이트 동일**하게 유지.
3. **벽·기둥 ID 안정화 (§8.3) — 백엔드와 프론트를 한 커밋에.** §9 위험 1 때문에 나눠 배포하면 안 된다.
4. **멤버십 DTO/서비스 교체 (§8.1, §8.4)** — `ZoneMemberDto`, `LayoutZoneMember`, `LayoutMetadataCopier` 종류 키 맵, `CandidateAdoptionService` 리더 함수.
5. **캔버스 선택 + 충돌 면제 (§1, §2)** — 프론트 단독. 3~4번과 병행 가능.
6. **계층 패널 (§3) → DnD + 컨텍스트 메뉴 (§4) → 그룹화 (§5, §6)** — 순차.

3번은 저장 시 소속이 사라지는 것을 막는 전제이므로 4번보다 반드시 먼저다.

## 검증

### 순수 함수 테스트 (기존 스타일: vitest, DOM 없음)

- `utils/zoneGeometry.test.ts` (신규): 회전된 기둥·구조물이 포함된 바운딩 박스, 벽 선분 끝점, 빈 선택 → null, 패딩 후 도면 범위 clamp
- `utils/zoneMembership.test.ts` (확장): 벽·기둥까지 그룹핑, 공용 시설은 그룹 대상 아님
- `utils/hitTest` (신규): Zone이 겹치는 구조물보다 **뒤** 우선순위인지
- 대체 비상구 제거에 따른 픽스처 수정: `zoneMembership.test.ts:27`, `structureConstraintPolicy.test.ts:13`

### 백엔드 테스트

- **`LayoutZoneSchemaIntegrationTest`** — DDL의 유일한 실행 가능 검증. 신규: `oneWallBelongsToAtMostOneZone`, `memberCannotReferenceWallFromAnotherLayoutVersion`, `deletingWallRemovesMembershipButKeepsZone`, `memberRequiresExactlyOneElementColumn`(두 컬럼 채우면 실패 / 전부 NULL이면 실패). 기존 `zoneCannotReferenceExitFromAnotherLayoutVersion`은 기본 비상구만으로 유지.
- `DrawingServiceIdentitySyncTest`: 벽·기둥 sync 케이스(구조물과 동일한 5가지) + 요청 배열 인덱스가 `display_order`로 전달되는지
- `LayoutZoneServiceTest`: `rejectsIdenticalDefaultAndAlternateExits` **삭제**, 벽·기둥 소속 검증 추가
- `CandidateAdoptionServiceTest`: `copy` 시그니처 변경 + 신규 `find*IdsByVersionId` 스텁
- `EvacuationPreviewServiceTest`: 단일 비상구 전제로 픽스처 수정
- **§9 위험 2 회귀 테스트**: 벽 id와 구조물 id가 같은 값일 때(예: 둘 다 7) `readMetadata`가 구조물 제약에 벽의 구역을 붙이지 않는지 — 이 버그는 테스트 없이는 눈에 안 띈다.

### 게이트

```bash
pnpm --filter @hwalro/frontend lint && pnpm --filter @hwalro/frontend build && pnpm --filter @hwalro/frontend test
cd apps/simulation-service && ./gradlew.bat spotlessCheck test
apps/simulation-service/engine/.venv/Scripts/python.exe -m pytest -q   # 엔진은 무영향, 회귀 확인용
diff deploy/init-db/02-simulation-schema.sql apps/simulation-service/src/main/resources/db/schema.sql  # 빈 출력이어야 함
```

Testcontainers는 이 환경에서 skip되므로(기존 조건), DDL은 `docker run mysql:8.4`에 직접 적용해 실측한다. 기존 dev DB(`hwalro-mysql`, 포트 3307)에는 **사용자 승인 없이 적용하지 않는다**.

### 수동 확인 (스택 기동 시)

1. Select 도구로 Zone 클릭 → 선택되고 오른쪽에 속성 표시
2. **구조물 위에** Zone 그리기 → 거부되지 않음
3. Zone을 구조물 위로 드래그 → 막히지 않음
4. 왼쪽 패널에 벽·기둥·구조물·Zone이 모두 행으로 표시
5. 패널에서 기둥을 Zone으로 드래그 → 소속 변경, 새로고침 후 유지
6. 벽+기둥+구조물 다중 선택 → 우클릭 → "구역으로 묶기" → 전체를 감싸는 Zone 생성
7. 도면 저장 후 새로고침 → 벽·기둥 소속과 순서 유지 (**ID 안정화 회귀 검증**)
