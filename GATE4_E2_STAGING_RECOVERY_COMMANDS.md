# Gate4-E2 Production Recovery — 로컬 통합 검증 명령 문서 (PowerShell)

- plan: `.omo/plans/gate4-e2-production-recovery-design.md` (§T6)
- 상태: **LOCAL_INTEGRATION_APPROVAL_REQUIRED** — 이 문서의 명령은 작성만 되었고 실행되지 않았습니다.
  사용자 승인 또는 사용자가 직접 실행한 결과가 있어야 다음 단계로 진행합니다.
- 범위: 이 프로젝트는 AWS나 별도 원격 staging 환경에 배포하지 않습니다. 여기서 "staging"은
  **로컬 통합 검증 환경**(docker-compose MySQL·Redis + 로컬 서비스 실행)을 의미합니다.
  원격 배포/registry/push/배포 파이프라인은 가정하지 않습니다.
- 원칙: 로컬 개발 DB migration은 **사용자 승인 후에만** 수행합니다. `SIMULATION_ENGINE_SHARED_TARGET_RECOVERY_ENABLED`
  기본값은 `false`이며, 로컬 flag=true는 검증 완료 후 사용자 승인이 있어야 유지합니다.
- 보안: MySQL 비밀번호를 명령행에 리터럴로 넣지 않습니다. docker exec 명령행에 비밀번호를 전달하지 않고
  **컨테이너 내부의 `SIMULATION_DB_PASSWORD` 환경 변수**를 사용합니다.

## 0. 사전 변수 설정 (외부 로컬 fixture 경로는 실행 전에 채우기)

```powershell
$migrationSql   = "apps\simulation-service\src\main\resources\db\migration-add-simulation-results-recovery-detail.sql"
$engineDir      = "apps\simulation-service\engine"
$exact13Fixture = "<로컬 외부 exact #13 input.json 경로>"   # repo 미커밋
$e0HashesFile   = "<exact #13 E0 4-hash JSON 경로>"          # repo 미커밋
$controlsDir    = "<controls(8개 specificity fixture) 디렉터리 경로>"  # repo 미커밋
$stagingSmokeDir = "<로컬 통합 검증용 smoke 모듈 디렉터리>"    # repo 미커밋
```

기존 로컬 실행 방식(`LOCAL_COMMANDS.md`): 인프라 실행 `pnpm run infra`, 서비스 실행
`pnpm --filter @hwalro/simulation-service dev`(=`dotenv -e ../../.env -- ./gradlew bootRun`, 포트 8081).
MySQL은 로컬 `hwalro-mysql` 컨테이너(3307)에 `hwalro_simulation` 계정(전 DB 권한)으로 접속합니다.

**인프라 사전 확인**: `pnpm run infra`는 컨테이너 기동 외에 `load-dev-test-data.mjs`(개발 테스트 데이터
로드)까지 실행하므로, **컨테이너가 없을 때만** 실행합니다.

```powershell
# hwalro-mysql 컨테이너가 이미 떠 있으면 pnpm run infra(데이터 로드 포함)를 건너뜁니다.
if (-not (docker compose ps --format "{{.Name}}" | Select-String -SimpleMatch "hwalro-mysql")) {
    pnpm run infra
}
```

## 1. DB migration 사전 확인 (읽기 전용)

비밀번호는 컨테이너 내부 `SIMULATION_DB_PASSWORD`를 사용하며 명령행에 노출하지 않습니다.

```powershell
"SHOW COLUMNS FROM simulation_results LIKE 'recovery_detail';" |
    docker exec -i hwalro-mysql sh -c 'mysql -uhwalro_simulation -p"$SIMULATION_DB_PASSWORD" hwalro_simulation -N'
```

- 출력이 비어 있으면 미적용 상태 → §2 migration 대상(사용자 승인 필요).
- `recovery_detail  json  YES`가 출력되면 이미 적용된 상태 → 아무것도 하지 않습니다.

## 2. DB migration 적용 — 사용자 승인 후에만 실행

```powershell
Get-Content -Raw $migrationSql |
    docker exec -i hwalro-mysql sh -c 'mysql -uhwalro_simulation -p"$SIMULATION_DB_PASSWORD" hwalro_simulation'
if (-not $?) { throw "migration 적용 실패 — 원인 보고 후 아래 forward-fix 규칙 사용 (rollback 금지)" }
```

적용 후 재확인(§1 명령)으로 `recovery_detail` 컬럼 1행을 확인합니다.
forward-fix 규칙: ALTER 재실행은 중복 컬럼 오류이므로, 재시도 시 §1 확인 후 **미적용 상태일 때만** §2를
다시 실행합니다. 실패 원인은 보고만 하고 rollback을 시도하지 않습니다.
신규 DB는 `db/schema.sql`에 이미 포함되어 있어 이 migration이 필요 없습니다.

## 3. 로컬 simulation-service flag=true 실행

`.env`는 수정하지 않습니다. 현재 셸에 환경 변수를 설정한 뒤 기존 dev 명령을 실행합니다
(dotenv-cli는 이미 설정된 프로세스 환경 변수를 덮어쓰지 않습니다).

```powershell
$env:SIMULATION_ENGINE_SHARED_TARGET_RECOVERY_ENABLED = "true"
pnpm --filter @hwalro/simulation-service dev
```

- application.yml 계약(한 줄 scalar): `shared-target-recovery-enabled: ${SIMULATION_ENGINE_SHARED_TARGET_RECOVERY_ENABLED:false}`
- 기동 확인: `netstat -ano | findstr "8081"` (기존 LOCAL_COMMANDS.md 방식)
- 검증 종료 후 flag 되돌리기(서비스 설정 복귀 — DB rollback 아님):
  `Remove-Item Env:SIMULATION_ENGINE_SHARED_TARGET_RECOVERY_ENABLED` 후 서비스 재기동.

## 4. exact #13 + controls 검증 (로컬 외부 fixture 경로)

exact #13 실제 도면 fixture와 controls는 repository에 커밋하지 않으며, 로컬 외부 경로로 opt-in합니다.
검증용 smoke 모듈은 다음 환경 변수 계약을 사용합니다.

| 환경 변수 | 의미 |
|---|---|
| `RUN_JUPEDSIM_SMOKE=1` | engine smoke 게이트 (기존 계약) |
| `EXACT_13_FIXTURE_PATH` | exact #13 input.json 경로 (로컬 외부, repo 미커밋) |
| `EXACT_13_E0_HASHES` | E0 4-hash JSON 경로: `{"result":"5acf1cfe…","tree":"3a69999a…","timeline":"09d62ce7…","heatmap":"7ad7463d…"}` |
| `EXACT_13_CONTROLS_DIR` | controls(8개 specificity fixture) 디렉터리 경로 |

```powershell
$env:RUN_JUPEDSIM_SMOKE = "1"
$env:EXACT_13_FIXTURE_PATH = $exact13Fixture
$env:EXACT_13_E0_HASHES = $e0HashesFile
$env:EXACT_13_CONTROLS_DIR = $controlsDir
Push-Location $engineDir
& .venv\Scripts\python.exe -m unittest discover -s $stagingSmokeDir -v
$smokeExit = $LASTEXITCODE
Pop-Location
if ($smokeExit -ne 0) { throw "exact #13 로컬 검증 실패 — 결과 보고 후 중단" }
```

검증 순서와 조건:
1. **먼저 exact #13 flag=false → E0 4 hash parity**(result/tree/timeline/heatmap) + `recoverySummary` 키 부재
2. 그다음 exact #13 flag=true → 386/386 ALL_EVACUATED, `recoveredAgentCount=3`, recovery 1회, 2회 결정성,
   recovery 전 timeline/heatmap prefix byte-exact
3. controls(8개 specificity fixture, flag=true) → recovery 발동 0회, 기존 결과/hash 계약 동일,
   fixture016 RT2 obstacle equilibrium 발동 금지
4. 이 시점에 functionalGate 확정(P1-10) — synthetic fixture는 negative-only이므로 exact #13 검증
   이전에는 미확정입니다.

## 5. DB 통합 테스트 확인 (Docker)

로컬 Docker에서 실제 실행 여부를 확인하고 tests/skipped 수를 보고합니다.

```powershell
Push-Location apps\simulation-service
.\gradlew.bat test --tests "com.hwalro.simulation.simulation.SimulationSchemaIntegrationTest"
Pop-Location
```

- 테스트 결과 XML(`build\test-results\test\TEST-*.xml`)의 `tests/skipped/failures` 수를 함께 보고합니다.
- skip이 남아 있으면 "Docker에서 실제 실행됨"으로 표현하지 않습니다(T21 미검증 유지).

## 6. flag=false 동안의 의미

- `SIMULATION_ENGINE_SHARED_TARGET_RECOVERY_ENABLED`가 false인 동안 실제 사용자 실행 결과는 개선되지 않습니다.
- 로컬 통합 검증 통과 + 사용자 승인 후에만 로컬/운영 flag=true를 유지합니다.
