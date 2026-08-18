# 대규모 대피 정체·미대피·단일 출구 성능 개선 명세

## 1. 문서 목적

이 문서는 DeepSeek가 현재 `dev`의 실제 실행 경로를 수정할 때 따라야 할 설계·검증 계약이다. 단순히 `STALLED` 판정을 느슨하게 하거나 출구 도달 반경을 키우는 것이 목적이 아니다.

반드시 다음을 각각 구분해서 해결한다.

| 영역 | 해결해야 할 질문 |
|---|---|
| 설정·위상 실패 | JuPedSim iteration 전에 이미 출구에 도달할 수 없는가 |
| 출구 포털 실패 | 출구 앞까지 왔지만 끝점·모서리 판정의 사각지대 때문에 제거되지 않는가 |
| 경로 추종 실패 | 유효한 경로가 있는데 waypoint 또는 target이 구조물 뒤를 가리키는가 |
| 이동 보정 실패 | JuPedSim 이동을 HWALRO가 반복 rollback하면서 복구 불가능한 상태를 만드는가 |
| 물리적 병목 | 좁은 단일 출구의 실제 유량 때문에 내부 시뮬레이션 시간이 길어지는가 |
| 계산 성능 | 같은 내부 1초를 계산하는 wall-clock 비용이 어디에서 증가하는가 |
| 종료·결과 계약 | 실행 실패, 부분 교착, 전역 교착, 최대 시간 도달을 사실대로 구분하는가 |

## 2. 기준 버전과 금지사항

- 분석 기준: `origin/dev` commit `dda3d9de1690856462866c2192649fa8fe609dae`
- 로컬 `dev`는 두 commit 뒤지만 `apps/simulation-service` tree SHA는 양쪽 모두 `d0887d5394f21e623286ba4c2dd67d691d03a56f`로 동일하다.
- 기존 native Journey/Waypoint 실험 브랜치, worktree, commit을 병합·cherry-pick·복사하지 않는다.
- 현재의 `GridRouter + DirectSteeringStage + SocialForceModel` 실행 경로 안에서 먼저 해결한다.
- 에이전트를 순간이동시키거나 장애물 통과를 허용하지 않는다.
- 출구 근처라는 이유만으로 임의 제거하지 않는다.
- `STALLED`나 `MAX_DURATION`을 `ALL_EVACUATED`로 바꾸지 않는다.
- reaction time을 조용히 clamp하거나 무시하지 않는다.
- 매 tick 전체 에이전트의 경로를 다시 계산하지 않는다.
- 이미 배치 처리된 `crossed_exits`, `reached_exits`, `can_reach_exits`, `valid_moves`를 scalar API 호출로 되돌리지 않는다.
- 출구 통과 검사는 invalid-move rollback보다 먼저 수행하는 현재 순서를 유지한다.

## 3. 현재 실제 실행 흐름

```text
SimulationExecutionService.execute / worker
  -> SimulationEngineRunner.run
  -> input.json 생성 및 runner.py 프로세스 실행
  -> drawing에서 physical walkable / routing geometry 생성
  -> routing component 분리
  -> component별 GridRouter 생성 및 exit seed 계산
  -> agent별 route/waypoint 생성
  -> JuPedSim SocialForceModel agent + DirectSteeringStage 생성
  -> simulation.iterate()
  -> agent state 일괄 수집
  -> 출구 crossing 판정
  -> HWALRO valid_moves 및 clamp/rollback
  -> waypoint cursor / target / exit 도달 갱신
  -> agent removal
  -> global STALLED / MAX_DURATION / ALL_EVACUATED 판정
  -> timeline / heatmap / result.json 기록
  -> Java가 모든 chunk를 읽고 검증
  -> DB result / metric / timeline / heatmap / bottleneck 저장
```

핵심 코드 위치는 다음과 같다.

| 단계 | 현재 코드 |
|---|---|
| Python 입력·geometry·component | `apps/simulation-service/engine/runner.py:361-429` |
| agent별 route 생성 | `apps/simulation-service/engine/runner.py:434-485` |
| iteration·종료 판정 | `apps/simulation-service/engine/runner.py:516-575` |
| JuPedSim iteration hot path | `apps/simulation-service/engine/runner.py:678-705` |
| crossing 후 rollback | `apps/simulation-service/engine/runner.py:708-758` |
| waypoint·exit·target 갱신 | `apps/simulation-service/engine/runner.py:761-836` |
| exit seed | `apps/simulation-service/engine/route_planner.py:584-629` |
| 이동·출구 batch predicate | `apps/simulation-service/engine/route_planner.py:652-779` |
| 출구 끝점 0.3m trim | `apps/simulation-service/engine/route_planner.py:948-965` |
| Java 프로세스·chunk read | `apps/simulation-service/src/main/java/com/hwalro/simulation/simulation/engine/SimulationEngineRunner.java:101-233` |
| 결과 검증·저장 | `apps/simulation-service/src/main/java/com/hwalro/simulation/simulation/service/SimulationExecutionService.java:321-419` |

## 4. 저장된 실패 사례에서 확인된 사실

### 4.1 사례 비교

| 사례 | 인원 / reaction time | 내부 시간 | 대피 / 잔류 | wall-clock | 확인된 특징 |
|---|---:|---:|---:|---:|---|
| #3 | 179 / 0.5s | 0.00s | 0 / 179 | 약 0.56s | 모든 agent component가 selected exit seed를 갖지 못해 iteration 0회 |
| #5 | 26 / 0.5s | 112.99s | 24 / 2 | 약 3.63s | 마지막 2명이 넓은 출구의 오른쪽 끝점·경계 모서리에 남음 |
| #6 | 79 / 2.0s | 158.49s | 69 / 10 | 약 35.82s | 마지막 10명이 출구가 아닌 fabric 구조물 두 군집에서 정지 |

비교 가능한 정상 사례도 있다.

- #2: #6과 같은 layout version 1, 24명, reaction time 0.5s, 63.47s에 전원 대피
- #4: 47명, reaction time 0.5s, 81.57s에 전원 대피
- #7: 2명인데도 내부 시간 0초 `STALLED`; #3과 같은 설정·위상 오분류가 반복됨

### 4.2 #3: 실행 중 교착이 아니라 실행 전 경로 불능

현재 `runner.py:424-428`은 `GridRouter`가 `no selected exit is reachable from this walkable component`를 발생시키면 해당 component의 agent를 `trapped` dictionary에 넣고 계속 진행한다. 모든 agent가 `trapped`이면 `runner.py:518`의 while 조건이 처음부터 거짓이다. 그 뒤 iteration 0 상태가 `STALLED` 결과로 저장된다.

즉 #3은 다음과 같다.

```text
특이 geometry
  -> occupied routing component에 selected exit seed 없음
  -> 179명 전부 trapped로 분류
  -> JuPedSim context 0개 / iteration 0회
  -> simulationDuration=0, STALLED
  -> 화면에서는 정상 계산 후 정체 종료처럼 보임
```

이것은 물리적 정체도, JuPedSim 계산 실패도 아니다. **실행 전 route/topology 계약 실패를 성공 결과처럼 저장한 분류 오류**다.

현재 `test_engine_smoke.py:187-234`의 `test_agent_without_connected_exit_remains_in_timeline`은 이 잘못된 동작을 회귀 계약으로 고정하고 있으므로 의도적으로 변경해야 한다.

### 4.3 #5: 출구 끝점·모서리의 completion 사각지대

- 선택 출구: `(31.2, 71.2) -> (51.1, 71.3)`, 폭 약 19.90m
- agent 반경 0.3m 때문에 routing에 사용하는 segment는 양 끝을 각각 0.3m 줄인다.
- 최종 잔류 위치:
  - agent 17: `(50.400991, 70.791952)`
  - agent 24: `(51.194426, 70.799881)`
- 두 agent의 마지막 5초 이동량은 각각 약 0.073m, 0.075m다.
- 최대 밀도는 3명/m²이고 24명은 이미 같은 출구로 나갔다.

두 agent는 출구 오른쪽 끝점과 경계 모서리 부근까지 도달했지만 다음 세 predicate가 서로 다른 geometry 계약을 사용한다.

1. 실제 movement와 usable exit segment의 교차
2. final waypoint 부근에서 terminal point까지 physical connector가 있는지
3. 현재 위치와 usable exit segment의 거리가 0.3m 이내인지

따라서 현재 증거로 가장 강한 가설은 **trim된 exit segment의 endpoint, final waypoint, 도달 반경 사이에 dead wedge가 존재하고, 그곳에서 target/rollback이 더 이상 crossing을 만들지 못한다**는 것이다. 구현 전에 rollback 횟수와 현재 target을 계측해 이 가설을 확정해야 한다.

### 4.4 #6: 출구 queue가 아닌 구조물 인접 route/rollback 정체

최종 10명은 두 군집에 남았다.

- `(124.9, 65~66)` 부근 2명: 구조물 18·32 사이의 gap/모서리
- `(91.5~97.2, 53.5~55.8)` 부근 8명: 구조물 67~72의 조밀한 fabric 군집

가까운 wall은 약 3.3~6.1m 떨어져 있고 최대 밀도는 3명/m²다. 마지막 5초 이동량은 대부분 0이며, 두 명도 0.001m 미만이다. 따라서 좁은 출구 앞의 물리적 queue보다는 다음 경로가 더 유력하다.

```text
waypoint/target이 구조물 뒤 또는 clearance 경계에 놓임
  -> JuPedSim이 target 방향으로 이동
  -> HWALRO valid_moves가 이동을 거부
  -> clamp 후 connector가 불가능하면 이전 위치로 full rollback
  -> velocity를 slide/zero 처리
  -> 같은 target을 계속 사용
  -> recovery 없이 반복
```

단, #6은 #2와 인원도 다르므로 reaction time 2.0만을 원인으로 단정할 수 없다. 같은 geometry, exit, 79개 초기 위치를 고정한 뒤 reaction time만 `0.5 / 1.0 / 2.0`으로 바꾸는 A/B 재현이 필요하다.

## 5. 목표 설계

### 5.1 실행 전 route/topology preflight

JuPedSim agent를 만들기 전에 다음 invariant를 모두 검사한다.

1. 선택 출구마다 agent clearance를 적용한 usable segment 길이가 양수다.
2. 현재 시스템이 최종 출구로 지원하는 topology를 만족한다.
3. agent가 존재하는 모든 routing component에 선택 출구의 유효한 seed가 최소 하나 있다.
4. component의 각 agent 시작점에서 해당 cost field까지 유한 경로가 존재한다.

하나라도 실패하면 result/timeline/heatmap을 정상 시뮬레이션 결과로 만들지 않는다. 기존 `AGENT_ROUTE_UNREACHABLE` 실패 경로를 일반화해 다음과 같은 typed failure detail을 반환한다.

```json
{
  "schemaVersion": 1,
  "code": "NO_REACHABLE_SELECTED_EXIT",
  "affectedAgentCount": 179,
  "representativeAgentIds": [1, 2, 3],
  "componentCount": 1,
  "selectedExitIds": [17],
  "reason": "NO_EXIT_SEED_IN_OCCUPIED_COMPONENT"
}
```

정확한 필드명은 기존 failure DTO와 호환되도록 조정할 수 있지만 다음 계약은 바꾸지 않는다.

- execution status: `FAILED`
- simulation result: 생성하지 않음
- termination reason `STALLED`: 사용하지 않음
- 사용자가 도면/출구 연결 문제임을 알 수 있는 안정적인 code 제공
- 개인정보나 전체 입력 geometry를 failure JSON에 복제하지 않음

내부에 떠 있는 선분을 최종 출구로 허용해야 한다면 이는 단순 버그 수정이 아니라 logical gate를 포함한 별도 제품 설계다. 이번 작업에서 임의로 지원하지 말고 명시적 validation failure로 처리한다.

### 5.2 단일한 ExitPortal 계약

출구와 관련된 다음 정보를 한 번만 계산해 공유하는 immutable value를 둔다.

| 값 | 의미 |
|---|---|
| raw segment | 사용자가 그린 원본 출구 |
| usable segment | agent 반경만큼 endpoint clearance를 적용한 중심 통과 구간 |
| inside normal | routing component 내부를 향하는 법선 |
| approach region | 내부에서 포털로 접근 가능한 clearance-safe 영역 |
| completion region | usable segment와 endpoint cap으로 구성된 내부 완료 영역 |

핵심은 exit seed, terminal point, crossing, reached/completion이 동일한 `ExitPortal`을 사용하게 하는 것이다. 현재처럼 각 단계가 별도의 숫자와 선분 해석을 가지면 안 된다.

대피 완료 조건은 다음 둘 중 하나다.

1. 이전 위치에서 현재 위치로의 이동이 **usable portal을 내부에서 외부로 교차**한다.
2. agent 중심이 **inside completion region**에 들어왔고, 현재 위치에서 portal의 대응점까지 physical geometry상 안전한 connector가 존재한다.

endpoint cap은 출구 원본 끝점 밖을 무제한으로 포함하는 원이 아니다. usable segment에서 파생된 반원/capsule 영역으로 만들고 내부 방향과 물리 geometry로 clip한다. 이로써 #5 오른쪽 끝점은 포함하되 벽 반대편 agent나 출구 옆 장애물 너머 agent를 제거하지 않는다.

final target은 raw endpoint가 아니라 현재 위치를 usable segment에 투영한 점 또는 그 점에서 inside normal 방향으로 떨어진 안전한 approach point다. endpoint로 비스듬히 몰리는 agent도 접선 방향으로 포털 중앙 쪽을 회복할 수 있어야 한다.

### 5.3 agent별 ProgressTracker와 원인 분류

전역 이동량 하나만 보지 말고 active agent마다 최소한 다음 rolling state를 유지한다.

- 최근 의미 있는 position progress 시각
- 현재 target/waypoint까지 거리의 감소량
- route cursor가 마지막으로 변경된 시각
- consecutive invalid move count
- consecutive full rollback count
- clamp 횟수와 보정 거리
- final portal stage 여부
- stuck recovery 횟수와 cooldown

운영 결과에는 원시 tick 전체를 저장하지 말고 집계만 남긴다.

| stall class | 판정 근거 | 의미 |
|---|---|---|
| `SETUP_UNREACHABLE` | iteration 전 route 없음 | 도면·출구 위상 실패 |
| `EXIT_PORTAL_STUCK` | final stage, portal 근처, crossing 없음, rollback/무진전 | #5 유형 |
| `ROUTE_FOLLOWING_STUCK` | exit에서 멀고 target progress 없음, rollback 반복 | #6 유형 |
| `PHYSICAL_CONGESTION` | 높은 local density, 출구 flow 존재, rollback 비율 낮음 | 실제 병목 |
| `GLOBAL_STALLED` | 모든 active agent가 의미 있는 progress 없음 | 현재 STALLED의 올바른 용도 |
| `PARTIAL_STALLED` | 일부는 움직이지만 특정 agent가 recovery 후에도 무진전 | 부분 미대피 진단 |

밀도 하나만으로 분류하지 않는다. progress, exit flow, rollback, target visibility를 함께 사용한다.

### 5.4 bounded stuck recovery

복구는 다음 조건을 모두 만족하는 agent에게만 실행한다.

- setup 때 유한 경로가 확인됨
- 일정 progress window 동안 target 거리와 실제 위치가 개선되지 않음
- invalid/full rollback 또는 target visibility 실패 증거가 있음
- recovery cooldown이 지남

복구 순서는 다음과 같다.

```text
현재 waypoint connector 재검증
  -> 다음 waypoint가 직접 보이면 안전하게 cursor advance
  -> 아니면 현재 위치를 기존 GridRouter cost field의 유효 node에 reconnect
  -> 동일한 선택 출구의 path suffix를 재구성
  -> clearance-aware line-of-sight simplification
  -> 새 첫 target이 physical/routing geometry 안인지 검증
  -> 제한된 횟수만 재시도
  -> 실패 시 PARTIAL_STALLED 진단에 원인을 남김
```

복구 시 금지사항:

- 위치를 옮기지 않는다.
- 선택 출구를 임의 변경하지 않는다.
- hazard soft cost를 제거하지 않는다.
- 장애물 intersection을 허용하지 않는다.
- 매 tick 전체 Dijkstra를 다시 실행하지 않는다.

`GridRouter`는 component별 선택 출구에 대한 reverse multi-source cost field를 이미 공유한다. 가능한 한 이 field를 재사용하고 stuck agent의 start connector/path suffix만 다시 만든다. replan 횟수는 agent별로 제한하고 telemetry에 기록한다.

### 5.5 reaction time 처리

reaction time이 커지면 Social Force Model의 desired velocity 복원력이 약해져 rollback 후 속도 회복이 느려질 수 있다. 그러나 이것은 반드시 A/B로 증명해야 한다.

지원 범위의 모든 reaction time에서 다음을 만족해야 한다.

- 유효한 route와 clearance가 있으면 구조물에서 영구 정지하지 않음
- rollback 후 target이 계속 구조물 뒤를 가리키는 상태를 recovery가 해소함
- reaction time 값에 따라 특수 분기하지 않음

JuPedSim/SFM 자체가 특정 범위에서 수치적으로 지원 불가능하다는 재현 증거가 나오면 입력값을 조용히 바꾸지 말고 다음 중 하나를 선택한다.

1. 제품의 지원 범위를 명시하고 실행 전 typed validation error로 거부
2. model profile/version을 올린 별도 동역학 변경으로 처리

### 5.6 종료 상태와 실행 상태 분리

Java의 `COMPLETED`는 엔진 계산과 결과 저장이 정상 완료되었다는 뜻이고, 전원 대피를 뜻하지 않는다. 다음처럼 두 축을 분리한다.

| execution status | simulation outcome | 의미 |
|---|---|---|
| `FAILED` | 없음 | #3처럼 실행 전 계약 실패 또는 엔진 오류 |
| `COMPLETED` | `ALL_EVACUATED` | 전원 대피 |
| `COMPLETED` | `STALLED` + detail | 계산은 정상, agent가 교착 상태로 종료 |
| `COMPLETED` | `MAX_DURATION` + detail | 계산은 정상, 설정 시간 내 미완료 |

`STALLED` 판정은 iteration이 최소 1회 이상 실행된 경우에만 가능해야 한다. 전역 이동량 합계는 partial deadlock과 micro-jitter를 놓치므로 agent별 progress state를 바탕으로 한다.

부분 교착의 diagnostic 예시는 다음과 같다.

```json
{
  "schemaVersion": 1,
  "globalReason": "PARTIAL_STALLED",
  "remainingPeople": 10,
  "reasonCounts": {
    "ROUTE_FOLLOWING_STUCK": 10
  },
  "representativeAgents": [5, 6, 8, 32, 41],
  "recoveryAttempts": 20,
  "fullRollbacks": 4312
}
```

이 정보가 API/UI에 필요하면 `simulation.failure_detail`을 재사용하지 않는다. 이는 execution failure용이기 때문이다. result에 additive `termination_detail` JSON을 추가하거나 정규화된 metric으로 저장하는 방안을 선택하고, DB migration과 producer/consumer 테스트를 함께 제공한다.

## 6. 단일 출구 5,000명 성능을 분해하는 방법

단일 출구에서는 계산 복잡도와 물리적 지속 시간이 동시에 증가한다.

출구 유량을 `q`명/s, 초기 인원을 `N`, timestep을 `dt`라 하면 이상적인 상한에서도 내부 대피 시간은 대략 `N/q`다. 각 tick에 active agent를 처리하므로 총 agent-step은 다음과 같이 증가한다.

```text
총 agent-step ~= (1/dt) * integral(active_agents(t) dt)
               ~= N^2 / (2 * q * dt)
```

따라서 per-tick이 O(active agents)여도 좁은 단일 출구에서는 전체 실행 시간이 N에 대해 2차처럼 보일 수 있다. 여러 출구는 합산 유량을 늘리고 평균 잔류 시간을 줄여 총 agent-step을 크게 낮춘다.

그러나 이것이 구현 비용을 면책하지는 않는다. 반드시 다음 두 축을 별도로 측정한다.

### 6.1 물리 축

- simulated evacuation duration
- exit별 초당 crossing flow
- active agent integral / 총 agent-step
- 출구 폭과 유효 폭
- 시간대별 local density와 queue 길이
- `ALL_EVACUATED`, `MAX_DURATION`, `STALLED` 여부

### 6.2 계산 축

- wall-clock / simulated second
- wall-clock / 1M agent-step
- `inputAndContextSetup`
- `routePlanning`
- JuPedSim `iterate`
- `agentStateCapture`
- `moveValidation`
- `targetAndExitUpdate`
- `snapshotAndSerialization`
- Java `resultRead`, `timelineRead`, `heatmapRead`, DB persist

경로 탐색은 component별 reverse multi-source field를 공유하는지 확인한다. agent마다 독립 Dijkstra를 실행하면 안 된다. JuPedSim 이웃 탐색은 local spatial search이지만, 출구 앞 비정상 고밀도에서는 후보 수가 커질 수 있으므로 density와 `iterate` 시간을 함께 본다.

기존 5,000명 합성 실행에서 출구 앞 최대 밀도가 수백~수천 명/m²로 나온 결과는 물리적 유량 검증 자료로 사용하면 안 된다. 이는 초기 배치/geometry가 비현실적인 stress test라는 신호다. 성능 stress와 물리 타당성 benchmark를 분리한다.

## 7. 구현 순서와 승인 게이트

### Gate 0: baseline 재현과 계측

코드를 고치기 전에 #3, #5, #6을 DB 비의존 JSON fixture로 축소·고정한다. 개인정보·업무명·불필요한 전체 도면을 제거하되 실패 topology와 agent 위치는 보존한다.

- #3: iteration 0, all trapped를 재현
- #5: 마지막 endpoint agent 2명이 남는 것을 재현
- #6: reaction time 2.0에서 fabric 인접 rollback 정지를 재현
- #6 A/B: agent/geometry/exit를 동일하게 두고 reaction time만 변경

각 fixture에서 target, cursor, invalid move, full rollback, recovery, exit crossing을 집계한다. 이 gate의 결과로 각 가설을 `confirmed / rejected / inconclusive`로 보고한 뒤 구현한다.

### Gate 1: #3 분류 수정

- component 무출구를 typed setup failure로 전환
- 기존 잘못된 smoke test 수정
- Java failure detail parsing/persist/API 테스트 추가
- t=0 `STALLED` 생성 금지

### Gate 2: ExitPortal 단일화와 #5 수정

- exit seed/target/crossing/completion이 같은 portal geometry 사용
- 양 endpoint, 사선 exit, boundary corner, 인접 wall 회귀 테스트
- 임의 반경 확장이나 teleport가 없음을 검증

### Gate 3: #6 bounded recovery

- agent progress/rollback telemetry
- stuck candidate만 reconnect/replan
- cooldown, attempt limit, deterministic 결과
- reaction time A/B 및 구조물 clearance 테스트

### Gate 4: 종료·결과 detail

- partial/global stall 구분
- Java validation과 저장 계약 확장
- 기존 API 소비자 영향 검사

### Gate 5: 정확성·성능 회귀

- 전체 Python 및 Java 테스트
- 정상 소규모 사례 결과 비교
- 5,000명 단일/다중 출구 phase profile 비교
- wall-clock과 simulated duration을 분리해 보고

## 8. 필수 회귀 테스트

### 8.1 #3 계열

1. occupied component에 selected exit seed가 없으면 실행 전에 실패한다.
2. 일부 component만 무출구여도 공식 실행은 부분 결과를 만들지 않고 실패한다.
3. 내부 floating exit가 현재 지원 대상이 아니면 명시적으로 실패한다.
4. t=0 `STALLED` result/timeline/heatmap이 생성되지 않는다.
5. error code와 affected count가 Java를 거쳐 API까지 보존된다.

### 8.2 #5 계열

1. 수평 출구의 왼쪽/오른쪽 endpoint 접근
2. 사선 출구의 양 endpoint 접근
3. outside boundary 모서리와 출구가 맞닿는 경우
4. 출구 옆에 wall 또는 pillar가 있는 음성 테스트
5. 실제 crossing agent는 rollback 전에 제거됨
6. wall 반대편에서 단순 거리만 가까운 agent는 제거되지 않음
7. 한 step의 위치 변화가 모델과 보정이 허용하는 범위를 넘지 않음

### 8.3 #6 계열

1. convex 구조물 모서리를 따라 target을 회복
2. 좁지만 agent clearance상 유효한 gap 통과
3. clearance상 불가능한 gap은 setup 또는 route failure로 사실대로 보고
4. repeated full rollback 뒤 bounded recovery 실행
5. cooldown 동안 replan 폭주 없음
6. 같은 입력·seed는 같은 종료 결과와 recovery count를 냄
7. reaction time `0.5 / 1.0 / 2.0` A/B

### 8.4 종료·성능

1. 움직이는 agent 한 명 때문에 영구 정지 agent가 감춰지지 않음
2. 작은 micro-jitter가 의미 있는 progress로 오인되지 않음
3. 실제 dense queue는 route failure로 오분류되지 않음
4. 정상 fixture에서 per-tick 전체 replan이 발생하지 않음
5. 기존 정상 fixture의 wall-clock median이 5% 이상 악화되면 원인을 설명하거나 최적화
6. 5,000명 결과에 phase별 시간, simulated seconds, agent-step을 함께 출력

## 9. 사례별 최종 합격 기준

| 사례 | 합격 기준 |
|---|---|
| #3 | `STALLED`가 아니라 iteration 전 `NO_REACHABLE_SELECTED_EXIT` 계열 실패. 결과를 전원 정지 시뮬레이션처럼 저장하지 않음 |
| #5 | 기존 26명 fixture에서 26명 모두 물리적으로 유효한 portal crossing/completion으로 대피. endpoint 반경 확대 꼼수와 장애물 통과 없음 |
| #6 | 동일 79명·동일 초기 위치·reaction 2.0 fixture에서 fabric rollback 교착이 사라짐. 불가능한 geometry라면 setup failure로 증명하고 성공으로 표시하지 않음 |
| 5,000명 단일 출구 | 물리 내부 시간과 계산 비용을 분리한 profile 제공. 동일 agent-step 비용 최적화와 출구 유량 한계를 각각 보고 |

#6의 79/79 대피가 성립하지 않을 수 있는 유일한 정당한 예외는 geometry상 실제로 연결되지 않았거나 clearance가 물리적으로 불가능하다는 것을 topology/connector 증거로 입증한 경우다. 이때도 `STALLED` 완화가 아니라 사전 실패 또는 정확한 미대피 원인으로 처리한다.

## 10. 변경 예상 파일

최소 변경 후보는 다음과 같다. 실제 구조를 확인한 뒤 범위를 좁힌다.

- `apps/simulation-service/engine/route_planner.py`
- `apps/simulation-service/engine/runner.py`
- `apps/simulation-service/engine/test_route_planner.py`
- `apps/simulation-service/engine/test_runner.py`
- `apps/simulation-service/engine/test_engine_smoke.py`
- `apps/simulation-service/src/main/java/com/hwalro/simulation/simulation/engine/SimulationEngineRunner.java`
- `apps/simulation-service/src/main/java/com/hwalro/simulation/simulation/service/SimulationExecutionService.java`
- failure/result DTO와 해당 Java 테스트
- diagnostic을 영속화하기로 한 경우 additive schema/mapper/API 테스트

## 11. 검증 명령

환경에 맞는 Python executable을 사용해 engine test를 실행한다.

```powershell
cd C:\Dev\HDF-3\hwalro\apps\simulation-service\engine
.\.venv\Scripts\python.exe -m unittest discover -v
```

Java 서비스 검증:

```powershell
cd C:\Dev\HDF-3\hwalro\apps\simulation-service
.\gradlew.bat spotlessCheck
.\gradlew.bat test
```

변경 후 반드시 다음 표를 숫자로 제출한다.

| fixture | before outcome | after outcome | simulated sec | wall sec | evacuated/remaining | rollback | recovery | replan |
|---|---|---|---:|---:|---:|---:|---:|---:|
| #3 |  |  |  |  |  |  |  |  |
| #5 |  |  |  |  |  |  |  |  |
| #6 RT=0.5 |  |  |  |  |  |  |  |  |
| #6 RT=1.0 |  |  |  |  |  |  |  |  |
| #6 RT=2.0 |  |  |  |  |  |  |  |  |
| 5k single exit |  |  |  |  |  |  |  |  |
| 5k multi exit |  |  |  |  |  |  |  |  |

## 12. DeepSeek에 전달할 실행 프롬프트

아래 내용을 DeepSeek에 그대로 전달한다.

```text
C:\Dev\HDF-3\hwalro 저장소의 최신 origin/dev를 기준으로 작업하라.

먼저 저장소 루트의 AGENTS.md와
SIMULATION_STALL_AND_SINGLE_EXIT_DEEPSEEK_BRIEF.md를 끝까지 읽고,
그 문서의 설계 계약·금지사항·승인 게이트·합격 기준을 따라라.

핵심 대상은 세 가지다.
1. #3: iteration 0회인데 STALLED로 저장되는 no-reachable-exit 오분류
2. #5: 출구 endpoint/corner의 completion 사각지대에 2명이 남는 문제
3. #6: reaction time 2.0 조건에서 fabric 구조물 인접 target/rollback 교착

추가로 5,000명 단일 출구 성능은 물리적 simulated duration과
동일 simulated second/agent-step 계산 비용을 반드시 분리해서 측정하라.

바로 수정부터 시작하지 마라. 먼저 Gate 0의 재현 fixture와 최소 계측으로
각 원인을 confirmed/rejected/inconclusive로 보고하라. 그 다음 Gate 1부터
순서대로 작은 변경과 테스트를 수행하라.

기존 native Journey/Waypoint 실험 브랜치나 worktree의 구현은
merge, cherry-pick, copy하지 마라. 현재 dev의 GridRouter,
DirectSteeringStage, SocialForceModel 경로에서 해결하라.

정확성을 훼손하는 해결은 금지한다. agent teleport, 장애물 통과,
출구 도달 반경의 임의 확대, reaction time 무시/clamp, 미대피를
ALL_EVACUATED로 표시하는 처리를 하지 마라. exit crossing-before-rollback과
기존 batch/vectorized path를 유지하고, 매 tick 전체 replan을 하지 마라.

각 gate마다 다음을 보고하고 검증이 실패하면 다음 gate로 진행하지 마라.
- 확인한 원인과 코드 위치
- 변경 파일과 설계 의도
- 추가/수정한 테스트
- 실행한 명령과 실제 결과
- before/after outcome, simulated sec, wall sec, evacuated/remaining
- rollback/recovery/replan 집계
- 남은 정확성 및 성능 위험

사용자 변경을 덮어쓰지 말고, 관련 없는 리팩터링이나 dependency 추가를 하지 마라.
모든 구현이 끝난 뒤 문서 11절의 비교표를 실제 측정값으로 채워 최종 보고하라.
```

## 13. 주의사항과 설계 한계

- #5의 endpoint dead wedge와 #6의 rollback loop는 저장 timeline과 최종 위치로 강하게 지지되지만, target/rollback counter가 현재 결과에 없으므로 Gate 0 계측 전에는 최종 확정 원인이라고 표현하면 안 된다.
- #6과 #2는 reaction time뿐 아니라 인원도 다르므로 기존 두 결과만으로 reaction time의 인과관계를 증명할 수 없다.
- single-exit 5,000명은 코드 최적화만으로 물리적 대피 시간을 줄일 수 없다. 출구 폭·출구 수·유량 모델 또는 최대 시뮬레이션 시간 정책 변경이 필요한 경우 이를 숨기지 않는다.
- 출구가 내부 logical gate로도 사용되어야 한다면 현재 최종 출구 모델을 확장하는 별도 설계가 필요하다. 이번 버그 수정에서 암묵적으로 구현하지 않는다.
- per-agent telemetry를 timeline 매 frame에 그대로 기록하면 결과 크기와 Java/DB I/O가 악화된다. 운영 저장은 집계와 대표 agent로 제한하고 상세 trace는 opt-in 진단 모드로 둔다.
