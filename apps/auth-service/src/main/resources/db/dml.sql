INSERT IGNORE INTO roles (role_name, description) VALUES
('ADMIN', '관리자'),
('OPERATOR', '운영 담당자'),
('SAFETY_REVIEWER', '안전 검토자');

UPDATE user_roles ur
JOIN roles old_role ON ur.role_id = old_role.role_id AND old_role.role_name = 'USER'
JOIN roles new_role ON new_role.role_name = 'SAFETY_REVIEWER'
SET ur.role_id = new_role.role_id;

DELETE FROM roles WHERE role_name = 'USER';

INSERT IGNORE INTO users (login_id, password, name, enabled) VALUES
('test', '$2y$10$0DguaN63igiENXyzyn0x3OAmPFc7Q6K0A/SASAgAGTdevBWltAl3q', '테스트', TRUE);

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u
JOIN roles r ON r.role_name = 'OPERATOR'
WHERE u.login_id = 'test';
