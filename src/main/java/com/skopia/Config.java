package com.skopia;

import java.nio.file.Path;

public record Config(
        String dbHost,
        int dbPort,
        String dbName,
        String dbUser,
        String dbPassword,
        int appPort,
        Path publicDir,
        Path uploadDir) {

    public static Config load() {
        Path root = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        return load(root.resolve("public"), root.resolve("uploads"));
    }

    public static Config load(Path webRoot) {
        Path root = webRoot.toAbsolutePath().normalize();
        return load(root, root.resolve("uploads"));
    }

    private static Config load(Path publicDir, Path uploadDir) {
        return new Config(
                env("DB_HOST", "127.0.0.1"),
                Integer.parseInt(env("DB_PORT", "3306")),
                env("DB_NAME", "skopia"),
                env("DB_USER", "root"),
                env("DB_PASSWORD", ""),
                Integer.parseInt(env("APP_PORT", "8080")),
                publicDir,
                uploadDir);
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value;
    }
}
