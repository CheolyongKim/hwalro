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
    status VARCHAR(30) NOT NULL,
    optimistic_lock INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_layout_versions PRIMARY KEY (id),
    CONSTRAINT uk_layout_versions_layout_version UNIQUE (layout_id, version),
    CONSTRAINT fk_layout_versions_layout
        FOREIGN KEY (layout_id) REFERENCES layouts (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

ALTER TABLE layouts
    ADD CONSTRAINT fk_layouts_current_version
        FOREIGN KEY (current_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS walls (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    start_x DECIMAL(12, 4) NOT NULL,
    start_y DECIMAL(12, 4) NOT NULL,
    end_x DECIMAL(12, 4) NOT NULL,
    end_y DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_walls PRIMARY KEY (id),
    CONSTRAINT fk_walls_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pillars (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    start_x DECIMAL(12, 4) NOT NULL,
    start_y DECIMAL(12, 4) NOT NULL,
    end_x DECIMAL(12, 4) NOT NULL,
    end_y DECIMAL(12, 4) NOT NULL,
    rotation DECIMAL(12, 4) NOT NULL DEFAULT 0,
    CONSTRAINT pk_pillars PRIMARY KEY (id),
    CONSTRAINT fk_pillars_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS fabrics (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    start_x DECIMAL(12, 4) NOT NULL,
    start_y DECIMAL(12, 4) NOT NULL,
    end_x DECIMAL(12, 4) NOT NULL,
    end_y DECIMAL(12, 4) NOT NULL,
    rotation DECIMAL(12, 4) NOT NULL DEFAULT 0,
    CONSTRAINT pk_fabrics PRIMARY KEY (id),
    CONSTRAINT fk_fabrics_layout_version
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

CREATE TABLE IF NOT EXISTS layout_exits (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    start_x DECIMAL(12, 4) NOT NULL,
    start_y DECIMAL(12, 4) NOT NULL,
    end_x DECIMAL(12, 4) NOT NULL,
    end_y DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_layout_exits PRIMARY KEY (id),
    CONSTRAINT uk_layout_exits_id_version UNIQUE (id, layout_version_id),
    CONSTRAINT fk_layout_exits_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS outside_walls (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    start_x DECIMAL(12, 4) NOT NULL,
    start_y DECIMAL(12, 4) NOT NULL,
    end_x DECIMAL(12, 4) NOT NULL,
    end_y DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_outside_walls PRIMARY KEY (id),
    CONSTRAINT fk_outside_walls_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    parent_simulation_id BIGINT UNSIGNED NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    requested_at DATETIME(6) NULL,
    started_at DATETIME(6) NULL,
    finished_at DATETIME(6) NULL,
    failure_message VARCHAR(1000) NULL,
    CONSTRAINT pk_simulations PRIMARY KEY (id),
    CONSTRAINT uk_simulations_id_version UNIQUE (id, layout_version_id),
    CONSTRAINT uk_simulations_id_parent UNIQUE (id, parent_simulation_id),
    CONSTRAINT ck_simulations_status CHECK (status IN ('DRAFT', 'REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED')),
    CONSTRAINT fk_simulations_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_simulations_parent_simulation
        FOREIGN KEY (parent_simulation_id, layout_version_id)
        REFERENCES simulations (id, layout_version_id)
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
    model_profile VARCHAR(50) NOT NULL DEFAULT 'SFM_DEFAULT_V2',
    routing_profile VARCHAR(50) NOT NULL DEFAULT 'HAZARD_RADIAL_EXP_V3',
    total_people INT UNSIGNED NOT NULL,
    walking_speed DECIMAL(8, 4) NOT NULL,
    reaction_time DECIMAL(8, 4) NOT NULL,
    CONSTRAINT pk_simulation_options PRIMARY KEY (id),
    CONSTRAINT uk_simulation_options_simulation UNIQUE (simulation_id),
    CONSTRAINT fk_simulation_options_simulation
        FOREIGN KEY (simulation_id) REFERENCES simulations (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulation_initial_states (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_id BIGINT UNSIGNED NOT NULL,
    agent_positions JSON NOT NULL,
    CONSTRAINT pk_simulation_initial_states PRIMARY KEY (id),
    CONSTRAINT uk_simulation_initial_states_simulation UNIQUE (simulation_id),
    CONSTRAINT fk_simulation_initial_states_simulation
        FOREIGN KEY (simulation_id) REFERENCES simulations (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulation_exits (
    simulation_id BIGINT UNSIGNED NOT NULL,
    layout_exit_id BIGINT UNSIGNED NOT NULL,
    layout_version_id BIGINT UNSIGNED NOT NULL,

    CONSTRAINT pk_simulation_exits
        PRIMARY KEY (simulation_id, layout_exit_id),

    CONSTRAINT fk_simulation_exits_simulation_version
        FOREIGN KEY (simulation_id, layout_version_id)
        REFERENCES simulations (id, layout_version_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_simulation_exits_layout_exit_version
        FOREIGN KEY (layout_exit_id, layout_version_id)
        REFERENCES layout_exits (id, layout_version_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
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
    engine_version VARCHAR(100) NOT NULL,
    termination_reason VARCHAR(30) NOT NULL,
    frame_interval_seconds DECIMAL(8, 3) NOT NULL,
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
    chunk_sequence INT UNSIGNED NOT NULL,
    frame_data JSON NOT NULL,
    CONSTRAINT pk_timelines PRIMARY KEY (id),
    CONSTRAINT uk_timelines_result_sequence UNIQUE (simulation_result_id, chunk_sequence),
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
    chunk_sequence INT UNSIGNED NOT NULL,
    density_data JSON NOT NULL,
    CONSTRAINT pk_heatmaps PRIMARY KEY (id),
    CONSTRAINT uk_heatmaps_result_sequence UNIQUE (simulation_result_id, chunk_sequence),
    CONSTRAINT fk_heatmaps_result
        FOREIGN KEY (simulation_result_id) REFERENCES simulation_results (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS detected_bottlenecks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    simulation_result_id BIGINT UNSIGNED NOT NULL,
    bottleneck_order INT UNSIGNED NOT NULL,
    start_time_seconds DOUBLE NOT NULL,
    end_time_seconds DOUBLE NOT NULL,
    peak_density DOUBLE NOT NULL,
    threshold_value DOUBLE NOT NULL,
    geometry JSON NOT NULL,
    analysis_version VARCHAR(50) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_detected_bottlenecks
    PRIMARY KEY (id),

    CONSTRAINT uk_detected_bottlenecks_result_order
    UNIQUE (simulation_result_id, bottleneck_order),

    CONSTRAINT fk_detected_bottlenecks_result
    FOREIGN KEY (simulation_result_id)
    REFERENCES simulation_results (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS improvement_proposals (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    source_simulation_id BIGINT UNSIGNED NOT NULL,
    saved_layout_version_id BIGINT UNSIGNED NULL,
    proposal_order INT UNSIGNED NOT NULL,
    proposal_type VARCHAR(30) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    change_data JSON NOT NULL,
    change_summary JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    saved_at DATETIME(6) NULL,
    CONSTRAINT pk_improvement_proposals PRIMARY KEY (id),
    CONSTRAINT uk_improvement_proposals_id_source UNIQUE (id, source_simulation_id),
    CONSTRAINT uk_improvement_proposals_source_order UNIQUE (source_simulation_id, proposal_order),
    CONSTRAINT uk_improvement_proposals_saved_layout_version UNIQUE (saved_layout_version_id),
    CONSTRAINT fk_improvement_proposals_source_simulation
        FOREIGN KEY (source_simulation_id) REFERENCES simulations (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_improvement_proposals_saved_layout_version
        FOREIGN KEY (saved_layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS proposal_simulations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    improvement_proposal_id BIGINT UNSIGNED NOT NULL,
    simulation_id BIGINT UNSIGNED NOT NULL,
    source_simulation_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_proposal_simulations PRIMARY KEY (id),
    CONSTRAINT uk_proposal_simulations_proposal UNIQUE (improvement_proposal_id),
    CONSTRAINT uk_proposal_simulations_simulation UNIQUE (simulation_id),
    CONSTRAINT fk_proposal_simulations_improvement_proposal_lineage
        FOREIGN KEY (improvement_proposal_id, source_simulation_id)
        REFERENCES improvement_proposals (id, source_simulation_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_proposal_simulations_simulation_lineage
        FOREIGN KEY (simulation_id, source_simulation_id)
        REFERENCES simulations (id, parent_simulation_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;
