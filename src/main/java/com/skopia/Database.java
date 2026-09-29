package com.skopia;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

final class Database {
    private final Config config;
    private final String databaseUrl;

    Database(Config config) {
        this.config = config;
        this.databaseUrl = "jdbc:mysql://" + config.dbHost() + ":" + config.dbPort() + "/" + config.dbName()
                + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=utf8";
    }

    void initialize() throws SQLException, IOException {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("MySQL Connector/J was not found. Reload the Maven project in IntelliJ.", e);
        }

        String serverUrl = "jdbc:mysql://" + config.dbHost() + ":" + config.dbPort()
                + "/?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC";
        try (Connection connection = DriverManager.getConnection(serverUrl, config.dbUser(), config.dbPassword());
             Statement statement = connection.createStatement()) {
            statement.executeUpdate("CREATE DATABASE IF NOT EXISTS `" + safeIdentifier(config.dbName())
                    + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        }

        String schema = readSchema();
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            for (String sql : schema.split(";\\s*(?:\\r?\\n|$)")) {
                String trimmed = sql.trim();
                if (!trimmed.isEmpty()) statement.execute(trimmed);
            }
        }
        migrateExistingInstall();
        seedDemoCredentials();
    }

    private String readSchema() throws IOException {
        try (InputStream stream = Database.class.getResourceAsStream("/database/schema.sql")) {
            if (stream != null) return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
        return Files.readString(Path.of("database", "schema.sql"));
    }

    Connection open() throws SQLException {
        return DriverManager.getConnection(databaseUrl, config.dbUser(), config.dbPassword());
    }

    private void migrateExistingInstall() throws SQLException {
        try (Connection connection = open(); Statement statement = connection.createStatement()) {
            if (!hasColumn(connection, "users", "email"))
                statement.executeUpdate("ALTER TABLE users ADD COLUMN email VARCHAR(254) NULL AFTER username");
            if (!hasColumn(connection, "users", "password_hash"))
                statement.executeUpdate("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email");
            if (!hasUniqueIndexOnColumn(connection, "users", "email"))
                statement.executeUpdate("ALTER TABLE users ADD UNIQUE INDEX uq_users_email (email)");
        }
    }

    private boolean hasColumn(Connection connection, String table, String column) throws SQLException {
        DatabaseMetaData metadata = connection.getMetaData();
        try (ResultSet rs = metadata.getColumns(connection.getCatalog(), null, table, column)) { return rs.next(); }
    }

    private boolean hasUniqueIndexOnColumn(Connection connection, String table, String column) throws SQLException {
        try (ResultSet rs = connection.getMetaData().getIndexInfo(connection.getCatalog(), null, table, true, false)) {
            while (rs.next()) if (column.equalsIgnoreCase(rs.getString("COLUMN_NAME"))) return true;
            return false;
        }
    }

    private void seedDemoCredentials() throws SQLException {
        seedAccount(1, "viewer@skopia.test", "Viewer123!");
        seedAccount(2, "creator@skopia.test", "Creator123!");
    }

    private void seedAccount(long userId, String email, String password) throws SQLException {
        try (Connection connection = open(); PreparedStatement ps = connection.prepareStatement(
                "UPDATE users SET email=COALESCE(email,?),password_hash=COALESCE(password_hash,?) WHERE user_id=?")) {
            ps.setString(1, email); ps.setString(2, PasswordSecurity.hash(password)); ps.setLong(3, userId);
            ps.executeUpdate();
        }
    }

    private String safeIdentifier(String value) {
        if (!value.matches("[A-Za-z0-9_]+")) throw new IllegalArgumentException("Invalid DB_NAME");
        return value;
    }
}
