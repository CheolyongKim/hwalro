-- Simulation-result integration fixture owner.
-- The password hash intentionally matches the existing local `test` account.

USE hwalro_auth;

START TRANSACTION;

INSERT INTO users (user_id, login_id, password, name, enabled)
VALUES (
    9001,
    'simulation-test',
    '$2y$10$0DguaN63igiENXyzyn0x3OAmPFc7Q6K0A/SASAgAGTdevBWltAl3q',
    '시뮬레이션 테스트 운영자',
    TRUE
)
ON DUPLICATE KEY UPDATE
    login_id = VALUES(login_id),
    password = VALUES(password),
    name = VALUES(name),
    enabled = VALUES(enabled);

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT 9001, role_id
FROM roles
WHERE role_name = 'OPERATOR';

COMMIT;
