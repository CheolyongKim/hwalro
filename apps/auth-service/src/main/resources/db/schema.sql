-- =====================================================================
-- hwalro auth-service: users 테이블 DDL
-- ERD 기준으로 정의 (login_id / password / name / role / timestamps)
-- 비밀번호는 BCrypt 해시(60자)로 저장한다.
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
    id         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '사용자 PK',
    login_id   VARCHAR(50)  NOT NULL COMMENT '로그인 아이디',
    password   VARCHAR(100) NOT NULL COMMENT 'BCrypt 해시된 비밀번호',
    name       VARCHAR(50)  NOT NULL COMMENT '사용자 이름',
    role       VARCHAR(20)  NOT NULL DEFAULT 'USER' COMMENT '권한 (USER, ADMIN)',
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시각',
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 시각',
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_login_id (login_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='사용자';

-- =====================================================================
-- 개발용 시드 데이터 (운영에는 별도 관리)
-- 비밀번호: admin1234 / user1234 (BCrypt 해시)
-- =====================================================================
INSERT IGNORE INTO users (login_id, password, name, role)
VALUES ('admin', '$2y$10$17Ca2fDVrSuHJSZtCABBjuPsiZqpEQ3EB8pkvBjTCp42J2cZ92o1m', '관리자', 'ADMIN'),
       ('user', '$2y$10$1GpKoxsXKmHfw9u5.repG.f3rLUW4PNz9m2eiZrVS6RLLE6QJ6y76', '일반사용자', 'USER');
