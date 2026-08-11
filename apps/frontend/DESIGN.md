# Design System — hwalro frontend

## 1. Design tokens

코드의 모든 색·타이포·간격 값은 이 문서와 `src/index.css`의 `@theme` 블록에 정의된 토큰에서 비롯된다. 새 토큰이 필요하면 `index.css`에 추가한 뒤 이 문서에 반영한다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--color-ink` | `#0d1917` | 페이지 최상위 텍스트 |
| `--color-ink-deep` | `#172a26` | 어두운 패널 텍스트 |
| `--color-lime` | `#c2e84b` | 포인트 액센트(재생/활성 상태) |
| `--color-background` | `#f3f6f4` | 밝은 배경 |
| `--color-primary` | `#168f80` | 주요 CTA·데이터 시리즈 메인 색 |
| `--color-primary-soft` | `#e4f3f0` | 선택된 행 배경 |
| `--color-surface` | `#f7faf9` | 표 헤더 배경 |
| `--color-line` | `#d6e2df` | 카드·테이블 테두리 |
| `--color-line-strong` | `#b8cbc7` | 아웃라인 버튼 테두리 |
| `--color-text-strong` | `#2f514c` | 표 본문 텍스트 |
| `--color-text-muted` | `#718884` | 부제목·라벨 텍스트 |
| `--font-sans` | Happiness Sans Print 외 | 본문·표시 폰트 |

간격 기준 단위는 4px 배수다. `simulationResult` 피처의 시뮬레이션 페이지 배경은 `#eef4f1`, 캔버스 위 플로팅 표면은 흰색 90% + `backdrop-filter: blur(14px)` + 틴트된 그림자(`rgba(22,55,49,…)`)를 쓴다.

## 2. Typography

- 폰트: `--font-sans`(Happiness Sans Print 400/700/900).
- 데이터 수치는 `font-variant-numeric: tabular-nums`로 정렬한다.
- 라벨은 10–12px, 카드 제목은 12px 700, 수치 강조는 900.

## 3. Elevation & surface

플로팅 패널(시뮬레이션 캔버스 위) 3요소:

1. 배경 `rgba(255,255,255,0.9)` + `backdrop-filter: blur(14px)`
2. 테두리 `1px solid rgba(151,177,170,0.4)`
3. 그림자 `0 18px 50px rgba(22,55,49,0.12)`

## 4. Motion

- 모션은 GPU 합성 속성(`transform`, `opacity`, `filter`)만 사용한다.
- 패널 축소/복원: `simulationResultMotion.css`의 `evacuation-chart-suck`(420ms) / `support-panel-rise`(340ms) 키프레임. 루트 요소의 `onAnimationEnd`로 상태 전이를 완료한다.
- `prefers-reduced-motion: reduce` 시 모든 패널 애니메이션을 1ms로 단축한다.

## 5. Chart primitive — 시간별 대피 인원

컴포넌트: `features/simulationResult/components/EvacuationProgressChart.tsx`

데이터: `EvacuationPoint[]` (`{ timeSeconds, evacuatedCount }`), 카드 루트는 `.evacuation-chart`(왼쪽 하단 플로팅, `left:22px; bottom:25px`, 너비 300px, `max-width:1100px`에서 250px).

시각 구성:

- **영역+라인**: `@tanstack/charts` `areaY`+`lineY` 마크. 영역은 `primary`(#168f80) 세로 그라데이션(하단 투명→상단 0.6), 라인은 2.25px `primary` + monotone 곡선.
- **축**: x는 경과 시간(초)을 `mm:ss`로 포맷, y는 대피 인원을 콤마(또는 compact)로 포맷. y 그리드라인은 `line` 색 1px.
- **툴팁**: 호버 시 시점·누적 대피 인원을 표시.
- **플레이헤드**: 재생 중 현재 시점 수직 가이드 + 라임 점. `transform`으로 매 프레임 이동(차트 정의는 새 데이터 포인트가 생길 때만 재생성).
- **헤더**: 제목 + 현재 대피 인원·진행률(콤마 + tabular-nums).

상태 계약: `isCollapsing`/`isExpanding`이면 루트에 `is-collapsing`/`is-expanding` 클래스를 붙이고, 애니메이션 종료 시 `onCollapseEnd`/`onExpandEnd`를 호출한다.
