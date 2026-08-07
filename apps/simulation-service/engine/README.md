# JuPedSim runner

표준 CPython 3.12 이상의 독립 프로세스로 실행하며 데이터베이스에는 접근하지 않는다.
Windows의 MSYS2 Python은 PyPI의 `win_amd64` wheel과 호환되지 않으므로 사용하지 않는다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --no-deps -r requirements.txt
.\.venv\Scripts\python.exe runner.py --version
.\.venv\Scripts\python.exe runner.py input.json output_dir
.\.venv\Scripts\python.exe -m unittest discover -s . -p "test_*.py"
```

## Windows 로컬 JuPedSim 빌드

활로 실행기는 에이전트가 유효 영역을 이탈했을 때 직전 위치로 복원하기 위해 `Agent.position`
setter가 추가된 로컬 JuPedSim 1.4.2 wheel을 사용한다. `requirements.txt` 설치는 공식 wheel로
되돌리므로, 의존성을 다시 설치한 뒤에는 아래 로컬 wheel도 다시 강제 설치해야 한다.

```powershell
git clone --branch v1.4.2 https://github.com/PedestrianDynamics/jupedsim.git C:\Dev\Utils\jupedsim-hwalro
git -C C:\Dev\Utils\jupedsim-hwalro switch -c hwalro/1.4.2-position-reset
```

로컬 소스에는 native binding과 Python `Agent.position` setter 변경만 적용한다. Visual Studio 2022
Developer PowerShell에서 다음 명령으로 빌드하고 설치한다.

```powershell
$enginePython = "C:\Dev\HDF-3\hwalro\apps\simulation-service\engine\.venv\Scripts\python.exe"
& $enginePython -m pip install setuptools wheel cmake ninja
& $enginePython -m pip wheel --no-build-isolation --no-deps `
  --wheel-dir C:\Dev\Utils\jupedsim-hwalro\dist `
  C:\Dev\Utils\jupedsim-hwalro
$localWheel = Get-ChildItem C:\Dev\Utils\jupedsim-hwalro\dist\jupedsim-1.4.2-*.whl |
  Select-Object -First 1 -ExpandProperty FullName
& $enginePython -m pip install --force-reinstall --no-deps $localWheel
& $enginePython runner.py --version
```

마지막 명령은 `jupedsim 1.4.2+hwalro.1`을 출력해야 한다. 공식 2.0.0 소스나 기존
`C:\Dev\Utils\jupedsim-master\jupedsim-master`는 이 프로젝트에서 사용하지 않는다.

simulation-service는 설정된 `SIMULATION_ENGINE_PYTHON`이 없으면 위 프로젝트 venv를 먼저 사용하고,
venv가 없을 때만 `python` 명령으로 대체한다.

입력 계약:

```json
{
  "model": {
    "modelProfile": "SFM_DEFAULT_V2",
    "routingProfile": "HAZARD_RADIAL_EXP_V3",
    "walkingSpeed": 1.2,
    "reactionTime": 0.5
  },
  "drawing": {
    "outsideBoundary": [{"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 5}, {"x": 0, "y": 5}],
    "walls": [],
    "pillars": [],
    "fabrics": [],
    "exits": [{"id": 1, "startX": 10, "startY": 2, "endX": 10, "endY": 3}]
  },
  "agents": [{"x": 1, "y": 2.5}],
  "hazards": [],
  "selectedExitIds": [1],
  "maxSimulationTimeSeconds": 600,
  "frameIntervalSeconds": 1
}
```

`output_dir/result.json`과 `output_dir/timeline/000000.json`부터 시작하는 청크를 생성한다. 타임라인 청크는 최대 10프레임이다.

구현은 JuPedSim 1.4의 [Simulation API](https://www.jupedsim.org/v1.4.0/api/jupedsim/index.html)와 [Direct Steering 예제](https://www.jupedsim.org/v1.4.0/notebooks/direct_steering.html)를 따른다.

## 배포

`apps/simulation-service`를 build context로 Docker 이미지를 만들면 Python 3.12와 공식
`jupedsim==1.4.2` wheel이 이미지에 함께 설치된다.

```bash
docker build -t hwalro-simulation-service apps/simulation-service
```

실행 경로와 실제 제한시간은 `SIMULATION_ENGINE_PYTHON`, `SIMULATION_ENGINE_SCRIPT`,
`SIMULATION_ENGINE_TIMEOUT`으로 조정할 수 있다. 현재 실행기 1개와 대기열 20개 및 재시작 복구는
애플리케이션 인스턴스 기준이므로, 분산 lease를 도입하기 전까지 AWS 배포 replica는 1개로 유지한다.
