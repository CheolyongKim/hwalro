CREATE DATABASE IF NOT EXISTS hwalro_simulation
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE hwalro_simulation;

CREATE TABLE IF NOT EXISTS floor_plans (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    image_url VARCHAR(2048) NULL,
    width DECIMAL(12, 4) NOT NULL,
    height DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_floor_plans PRIMARY KEY (id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS layouts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    floor_plan_id BIGINT UNSIGNED NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    current_version_id BIGINT UNSIGNED NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_layouts PRIMARY KEY (id),
    CONSTRAINT fk_layouts_floor_plan
        FOREIGN KEY (floor_plan_id) REFERENCES floor_plans (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    INDEX idx_layouts_created_by (created_by)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS layout_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    parent_version_id BIGINT UNSIGNED NULL,
    status VARCHAR(30) NOT NULL,
    optimistic_lock INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_layout_versions PRIMARY KEY (id),
    CONSTRAINT uk_layout_versions_layout_version UNIQUE (layout_id, version),
    CONSTRAINT fk_layout_versions_layout
        FOREIGN KEY (layout_id) REFERENCES layouts (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_layout_versions_parent
        FOREIGN KEY (parent_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

ALTER TABLE layouts
    ADD CONSTRAINT fk_layouts_current_version
        FOREIGN KEY (current_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS facilities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    start_x DECIMAL(12, 4) NOT NULL,
    start_y DECIMAL(12, 4) NOT NULL,
    end_x DECIMAL(12, 4) NOT NULL,
    end_y DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_facilities PRIMARY KEY (id),
    CONSTRAINT fk_facilities_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS layout_texts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    text TEXT NOT NULL,
    x DECIMAL(12, 4) NOT NULL,
    y DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_layout_texts PRIMARY KEY (id),
    CONSTRAINT fk_layout_texts_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    status VARCHAR(30) NOT NULL,
    requested_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    CONSTRAINT pk_simulations PRIMARY KEY (id),
    CONSTRAINT fk_simulations_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    INDEX idx_simulations_created_by (created_by)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulation_options (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_id BIGINT UNSIGNED NOT NULL,
    random_seed INT NOT NULL,
    total_people INT UNSIGNED NOT NULL,
    walking_speed DECIMAL(8, 4) NOT NULL,
    CONSTRAINT pk_simulation_options PRIMARY KEY (id),
    CONSTRAINT uk_simulation_options_simulation UNIQUE (simulation_id),
    CONSTRAINT fk_simulation_options_simulation
        FOREIGN KEY (simulation_id) REFERENCES simulations (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS person_distributions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    people_count INT UNSIGNED NOT NULL,
    center_x DECIMAL(12, 4) NOT NULL,
    center_y DECIMAL(12, 4) NOT NULL,
    radius DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_person_distributions PRIMARY KEY (id),
    CONSTRAINT fk_person_distributions_simulation
        FOREIGN KEY (simulation_id) REFERENCES simulations (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS hazard_zones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_id BIGINT UNSIGNED NOT NULL,
    center_x DECIMAL(12, 4) NOT NULL,
    center_y DECIMAL(12, 4) NOT NULL,
    radius DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_hazard_zones PRIMARY KEY (id),
    CONSTRAINT fk_hazard_zones_simulation
        FOREIGN KEY (simulation_id) REFERENCES simulations (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulation_results (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_simulation_results PRIMARY KEY (id),
    CONSTRAINT uk_simulation_results_simulation UNIQUE (simulation_id),
    CONSTRAINT fk_simulation_results_simulation
        FOREIGN KEY (simulation_id) REFERENCES simulations (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulation_metrics (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_result_id BIGINT UNSIGNED NOT NULL,
    unit VARCHAR(50) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DOUBLE NOT NULL,
    CONSTRAINT pk_simulation_metrics PRIMARY KEY (id),
    CONSTRAINT fk_simulation_metrics_result
        FOREIGN KEY (simulation_result_id) REFERENCES simulation_results (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS timelines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_result_id BIGINT UNSIGNED NOT NULL,
    frame_data JSON NOT NULL,
    CONSTRAINT pk_timelines PRIMARY KEY (id),
    CONSTRAINT uk_timelines_result UNIQUE (simulation_result_id),
    CONSTRAINT fk_timelines_result
        FOREIGN KEY (simulation_result_id) REFERENCES simulation_results (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS heatmaps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_result_id BIGINT UNSIGNED NOT NULL,
    density_data JSON NOT NULL,
    CONSTRAINT pk_heatmaps PRIMARY KEY (id),
    CONSTRAINT uk_heatmaps_result UNIQUE (simulation_result_id),
    CONSTRAINT fk_heatmaps_result
        FOREIGN KEY (simulation_result_id) REFERENCES simulation_results (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;
