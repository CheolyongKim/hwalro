-- External IDs in this fixture refer to simulation-service result 9301 and auth-service user 9001.

USE hwalro_regulation;

START TRANSACTION;

DELETE FROM risks WHERE id IN (9401, 9402);

INSERT INTO risks (
    id,
    simulation_result_id,
    assignee_id,
    title,
    description,
    start_x,
    start_y,
    end_x,
    end_y,
    severity,
    status,
    created_at
) VALUES
(
    9401,
    9301,
    9001,
    '중앙 행사 집기 인접 구역',
    '사용자가 결과 화면에서 지정한 위험 예상 구역 테스트 데이터',
    88.0000,
    34.0000,
    117.0000,
    59.0000,
    'HIGH',
    'OPEN',
    '2026-08-07 10:30:00.000000'
),
(
    9402,
    9301,
    9001,
    '남측 출구 대기 구역',
    '남측 출구 앞 대기열 발생 가능성을 확인하기 위한 테스트 데이터',
    132.0000,
    66.0000,
    157.0000,
    90.0000,
    'MEDIUM',
    'OPEN',
    '2026-08-07 10:31:00.000000'
);

COMMIT;
