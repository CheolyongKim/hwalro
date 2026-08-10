package com.hwalro.simulation.simulation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
class SimulationSchemaIntegrationTest {
    @Container
    private static final MySQLContainer<?> MYSQL =
            new MySQLContainer<>("mysql:8.4").withDatabaseName("hwalro_simulation");

    @BeforeAll
    static void createSchema() throws SQLException {
        try (Connection connection = connection()) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/schema.sql"));
        }
    }

    @Test
    void simulationOptionsHasModelProfile() throws SQLException {
        try (Connection connection = connection();
                Statement statement = connection.createStatement();
                ResultSet columns =
                        statement.executeQuery("SHOW COLUMNS FROM simulation_options LIKE 'model_profile'")) {
            assertThat(columns.next()).isTrue();
            assertThat(columns.getString("Default")).isEqualTo("SFM_DEFAULT_V2");
        }
        try (Connection connection = connection();
                Statement statement = connection.createStatement();
                ResultSet columns =
                        statement.executeQuery("SHOW COLUMNS FROM simulation_options LIKE 'routing_profile'")) {
            assertThat(columns.next()).isTrue();
            assertThat(columns.getString("Default")).isEqualTo("HAZARD_RADIAL_EXP_V3");
        }
    }

    @Test
    void densityThresholdSettingAllowsOnlyOnePositivePersonPerSquareMeterValue() throws SQLException {
        try (Connection connection = connection();
                Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM density_threshold_settings");
            statement.executeUpdate("INSERT INTO density_threshold_settings (id, threshold_value, unit) "
                    + "VALUES (1, 3.500, 'PERSON_PER_M2')");

            assertThatThrownBy(() -> statement.executeUpdate(
                            "INSERT INTO density_threshold_settings (id, threshold_value, unit) "
                                    + "VALUES (2, 3.500, 'PERSON_PER_M2')"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> statement.executeUpdate(
                            "UPDATE density_threshold_settings SET threshold_value = 0 WHERE id = 1"))
                    .isInstanceOf(SQLException.class);
            assertThatThrownBy(() -> statement.executeUpdate(
                            "UPDATE density_threshold_settings SET unit = 'PEOPLE' WHERE id = 1"))
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void densityThresholdDmlInitializesButDoesNotOverwriteExistingValue() throws SQLException {
        try (Connection connection = connection();
                Statement statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM density_threshold_settings");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/density-threshold-dml.sql"));
            assertThat(densityThreshold(statement)).isEqualByComparingTo("3.500");

            statement.executeUpdate("UPDATE density_threshold_settings SET threshold_value = 4.200 WHERE id = 1");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/density-threshold-dml.sql"));
            assertThat(densityThreshold(statement)).isEqualByComparingTo("4.200");
        }
    }

    @Test
    void parentSimulationMustBelongToSameLayoutVersion() throws SQLException {
        try (Connection connection = connection();
                Statement statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO floor_plans (id, name, width, height) VALUES (911, 'parent', 10, 10)");
            statement.executeUpdate(
                    "INSERT INTO layouts (id, floor_plan_id, created_by, title) VALUES (912, 911, 7, 'parent')");
            statement.executeUpdate("INSERT INTO layout_versions (id, layout_id, version, status) VALUES "
                    + "(913, 912, 1, '잠금'), (914, 912, 2, '잠금')");
            statement.executeUpdate("INSERT INTO simulations (id, layout_version_id, created_by, status) "
                    + "VALUES (915, 913, 7, 'DRAFT')");

            assertThatThrownBy(() -> statement.executeUpdate("INSERT INTO simulations "
                            + "(id, layout_version_id, parent_simulation_id, created_by, status) "
                            + "VALUES (916, 914, 915, 7, 'DRAFT')"))
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void simulationStatusIsConstrained() throws SQLException {
        try (Connection connection = connection();
                Statement statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO floor_plans (id, name, width, height) VALUES (921, 'status', 10, 10)");
            statement.executeUpdate(
                    "INSERT INTO layouts (id, floor_plan_id, created_by, title) VALUES (922, 921, 7, 'status')");
            statement.executeUpdate(
                    "INSERT INTO layout_versions (id, layout_id, version, status) VALUES (923, 922, 1, '잠금')");

            assertThatThrownBy(() -> statement.executeUpdate(
                            "INSERT INTO simulations (id, layout_version_id, created_by, status) "
                                    + "VALUES (924, 923, 7, 'UNKNOWN')"))
                    .isInstanceOf(SQLException.class);
        }
    }

    @Test
    void simulationExitMustBelongToSameLayoutVersion() throws SQLException {
        try (Connection connection = connection();
                Statement statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO floor_plans (id, name, width, height) VALUES (901, 'test', 10, 10)");
            statement.executeUpdate(
                    "INSERT INTO layouts (id, floor_plan_id, created_by, title) VALUES (902, 901, 7, 'test')");
            statement.executeUpdate("INSERT INTO layout_versions (id, layout_id, version, status) VALUES "
                    + "(903, 902, 1, '잠금'), (904, 902, 2, '잠금')");
            statement.executeUpdate("INSERT INTO layout_exits "
                    + "(id, layout_version_id, name, start_x, start_y, end_x, end_y) "
                    + "VALUES (905, 904, 'exit', 0, 0, 1, 0)");
            statement.executeUpdate("INSERT INTO simulations (id, layout_version_id, created_by, status) "
                    + "VALUES (906, 903, 7, 'DRAFT')");

            assertThatThrownBy(() -> statement.executeUpdate(
                            "INSERT INTO simulation_exits (simulation_id, layout_exit_id, layout_version_id) "
                                    + "VALUES (906, 905, 903)"))
                    .isInstanceOf(SQLException.class);
        }
    }

    private static Connection connection() throws SQLException {
        return DriverManager.getConnection(MYSQL.getJdbcUrl(), MYSQL.getUsername(), MYSQL.getPassword());
    }

    private static java.math.BigDecimal densityThreshold(Statement statement) throws SQLException {
        try (ResultSet resultSet =
                statement.executeQuery("SELECT threshold_value FROM density_threshold_settings WHERE id = 1")) {
            assertThat(resultSet.next()).isTrue();
            return resultSet.getBigDecimal("threshold_value");
        }
    }
}
