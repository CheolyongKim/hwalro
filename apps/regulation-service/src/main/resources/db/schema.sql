CREATE DATABASE IF NOT EXISTS hwalro_regulation
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE hwalro_regulation;

CREATE TABLE IF NOT EXISTS risks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_result_id BIGINT UNSIGNED NOT NULL,
    assignee_id BIGINT UNSIGNED NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    start_x DECIMAL(12, 4),
    start_y DECIMAL(12, 4),
    end_x DECIMAL(12, 4),
    end_y DECIMAL(12, 4),
    severity VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_risks PRIMARY KEY (id),
    INDEX idx_risks_simulation_result_id (simulation_result_id),
    INDEX idx_risks_assignee_id (assignee_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS safety_checks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    risk_id BIGINT UNSIGNED NOT NULL,
    inspector_id BIGINT UNSIGNED NOT NULL,
    passed BOOLEAN NOT NULL,
    comment TEXT NULL,
    checked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_safety_checks PRIMARY KEY (id),
    CONSTRAINT fk_safety_checks_risk
        FOREIGN KEY (risk_id) REFERENCES risks (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    INDEX idx_safety_checks_inspector_id (inspector_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS checklist_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    category VARCHAR(30) NOT NULL,
    CONSTRAINT pk_checklist_items PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS safety_check_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    safety_check_id BIGINT UNSIGNED NOT NULL,
    checklist_item_id BIGINT UNSIGNED NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    comment TEXT NULL,
    CONSTRAINT pk_safety_check_items PRIMARY KEY (id),
    CONSTRAINT uk_safety_check_items_check_item
        UNIQUE (safety_check_id, checklist_item_id),
    CONSTRAINT fk_safety_check_items_safety_check
        FOREIGN KEY (safety_check_id) REFERENCES safety_checks (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_safety_check_items_checklist_item
        FOREIGN KEY (checklist_item_id) REFERENCES checklist_items (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    author_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT NULL,
    ai_summary LONGTEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_reports PRIMARY KEY (id),
    INDEX idx_reports_author_id (author_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS report_simulations (
    report_id BIGINT UNSIGNED NOT NULL,
    simulation_result_id BIGINT UNSIGNED NOT NULL,
    CONSTRAINT pk_report_simulations PRIMARY KEY (report_id, simulation_result_id),
    CONSTRAINT fk_report_simulations_report
        FOREIGN KEY (report_id) REFERENCES reports (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    INDEX idx_report_simulations_simulation_result_id (simulation_result_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS manuals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,
    CONSTRAINT pk_manuals PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;
