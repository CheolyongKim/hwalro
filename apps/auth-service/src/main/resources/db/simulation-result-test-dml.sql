-- Simulation-result integration fixture owner.
-- The password hash intentionally matches the existing local `test` account.

USE hwalro_auth;

START TRANSACTION;

CREATE TEMPORARY TABLE simulation_result_fixture_assertions (
    assertion_name VARCHAR(100) NOT NULL,
    condition_met TINYINT NOT NULL,
    CONSTRAINT chk_simulation_result_fixture_assertion CHECK (condition_met = 1)
);

INSERT INTO simulation_result_fixture_assertions (assertion_name, condition_met)
SELECT 'OPERATOR 역할이 먼저 생성되어 있어야 합니다.',
       CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
FROM roles
WHERE role_name = 'OPERATOR';

INSERT INTO simulation_result_fixture_assertions (assertion_name, condition_met)
SELECT 'user_id 9001 또는 simulation-test 로그인 ID가 다른 사용자와 충돌합니다.',
       CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM users
WHERE (user_id = 9001 OR login_id = 'simulation-test')
  AND NOT (user_id = 9001 AND login_id = 'simulation-test');

INSERT INTO users (user_id, login_id, password, name, enabled)
VALUES (
    9001,
    'simulation-test',
    '$2y$10$0DguaN63igiENXyzyn0x3OAmPFc7Q6K0A/SASAgAGTdevBWltAl3q',
    '시뮬레이션 테스트 운영자',
    TRUE
)
ON DUPLICATE KEY UPDATE
    user_id = VALUES(user_id);

INSERT INTO user_roles (user_id, role_id)
SELECT 9001, role_id
FROM roles
WHERE role_name = 'OPERATOR'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

DROP TEMPORARY TABLE simulation_result_fixture_assertions;

COMMIT;
