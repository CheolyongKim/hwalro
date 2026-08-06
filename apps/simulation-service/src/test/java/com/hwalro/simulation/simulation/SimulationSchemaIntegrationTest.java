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
            assertThat(columns.getString("Default")).isEqualTo("SFM_DEFAULT_V1");
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
}
