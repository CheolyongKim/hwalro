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

simulation-service는 설정된 `SIMULATION_ENGINE_PYTHON`이 없으면 위 프로젝트 venv를 먼저 사용하고,
venv가 없을 때만 `python` 명령으로 대체한다.

입력 계약:

```json
{
  "model": {
    "modelProfile": "SFM_DEFAULT_V1",
    "routingProfile": "HAZARD_RADIAL_EXP_V2",
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
