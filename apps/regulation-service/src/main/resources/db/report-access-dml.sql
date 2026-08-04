-- 보고서 목록 권한 확인용 수동 DML이다. 애플리케이션 시작 시 자동 실행하지 않는다.
-- 1) hwalro_auth.users에서 테스트할 운영 담당자와 안전 검토자의 user_id를 확인한다.
-- 2) 아래 두 변수 값을 실제 user_id로 바꾼 뒤 이 스크립트를 실행한다.

USE hwalro_auth;

SET @operator_id = 2;
SET @safety_reviewer_id = 3;

INSERT IGNORE INTO roles (role_name, description) VALUES
    ('OPERATOR', '운영 담당자'),
    ('SAFETY_REVIEWER', '안전 검토자');

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT @operator_id, role_id
FROM roles
WHERE role_name = 'OPERATOR';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT @safety_reviewer_id, role_id
FROM roles
WHERE role_name = 'SAFETY_REVIEWER';

USE hwalro_regulation;

-- 운영 담당자는 author_id가 자신의 ID인 보고서만, 안전 검토자는 아래 전체 보고서를 조회한다.
INSERT INTO reports (author_id, title, content, status, created_at, updated_at) VALUES
    (@operator_id, '운영 담당자 권한 확인 보고서', '운영 담당자 본인 조회 검증용 보고서입니다.', '작성 중', NOW(6), NOW(6)),
    (@safety_reviewer_id, '안전 검토자 권한 확인 보고서', '안전 검토자 전체 조회 검증용 보고서입니다.', '완료', NOW(6), NOW(6));

-- 확인 쿼리
SELECT id, author_id, title, status, updated_at
FROM reports
WHERE author_id IN (@operator_id, @safety_reviewer_id)
ORDER BY updated_at DESC, id DESC;
