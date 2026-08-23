-- 2026-08-22: additive migration for existing simulation databases.
-- Adds version-owned operational Zones, Zone-to-Structure membership, layout
-- placement exclusions, and per-Structure placement constraints on fabrics.
-- New installs get all of this from db/schema.sql; existing databases must
-- apply this file once. Run the statements in order: the composite foreign keys
-- in layout_zone_structures require uk_fabrics_id_version to exist first.
ALTER TABLE fabrics
    ADD COLUMN movable BOOLEAN NOT NULL DEFAULT TRUE AFTER rotation,
    ADD COLUMN max_movement_distance DECIMAL(12, 4) NULL AFTER movable,
    ADD COLUMN rotation_locked BOOLEAN NOT NULL DEFAULT FALSE AFTER max_movement_distance,
    ADD COLUMN keep_against_wall BOOLEAN NOT NULL DEFAULT FALSE AFTER rotation_locked,
    ADD CONSTRAINT uk_fabrics_id_version UNIQUE (id, layout_version_id),
    ADD CONSTRAINT ck_fabrics_max_movement_distance
        CHECK (max_movement_distance IS NULL OR max_movement_distance > 0);

CREATE TABLE IF NOT EXISTS layout_zones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,
    zone_type VARCHAR(40) NOT NULL,
    x DECIMAL(12, 4) NOT NULL,
    y DECIMAL(12, 4) NOT NULL,
    width DECIMAL(12, 4) NOT NULL,
    height DECIMAL(12, 4) NOT NULL,
    assigned_user_id BIGINT UNSIGNED NULL,
    default_exit_id BIGINT UNSIGNED NULL,
    alternate_exit_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT pk_layout_zones PRIMARY KEY (id),
    CONSTRAINT uk_layout_zones_id_version UNIQUE (id, layout_version_id),
    CONSTRAINT uk_layout_zones_version_name UNIQUE (layout_version_id, name),
    CONSTRAINT ck_layout_zones_extent CHECK (width > 0 AND height > 0),
    CONSTRAINT ck_layout_zones_alternate_differs
        CHECK (alternate_exit_id IS NULL
               OR default_exit_id IS NULL
               OR alternate_exit_id <> default_exit_id),
    CONSTRAINT fk_layout_zones_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_layout_zones_default_exit
        FOREIGN KEY (default_exit_id, layout_version_id)
        REFERENCES layout_exits (id, layout_version_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT fk_layout_zones_alternate_exit
        FOREIGN KEY (alternate_exit_id, layout_version_id)
        REFERENCES layout_exits (id, layout_version_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    INDEX idx_layout_zones_assigned_user (assigned_user_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS layout_zone_structures (
    layout_version_id BIGINT UNSIGNED NOT NULL,
    zone_id BIGINT UNSIGNED NOT NULL,
    fabric_id BIGINT UNSIGNED NOT NULL,
    CONSTRAINT pk_layout_zone_structures PRIMARY KEY (layout_version_id, fabric_id),
    CONSTRAINT fk_layout_zone_structures_zone
        FOREIGN KEY (zone_id, layout_version_id)
        REFERENCES layout_zones (id, layout_version_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    CONSTRAINT fk_layout_zone_structures_fabric
        FOREIGN KEY (fabric_id, layout_version_id)
        REFERENCES fabrics (id, layout_version_id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,
    INDEX idx_layout_zone_structures_zone (zone_id)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS layout_placement_exclusions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    layout_version_id BIGINT UNSIGNED NOT NULL,
    x DECIMAL(12, 4) NOT NULL,
    y DECIMAL(12, 4) NOT NULL,
    width DECIMAL(12, 4) NOT NULL,
    height DECIMAL(12, 4) NOT NULL,
    CONSTRAINT pk_layout_placement_exclusions PRIMARY KEY (id),
    CONSTRAINT ck_layout_placement_exclusions_extent CHECK (width > 0 AND height > 0),
    CONSTRAINT fk_layout_placement_exclusions_layout_version
        FOREIGN KEY (layout_version_id) REFERENCES layout_versions (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;
