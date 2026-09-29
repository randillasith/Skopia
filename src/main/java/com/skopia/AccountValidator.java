package com.skopia;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

final class AccountValidator {
    private static final Pattern USERNAME = Pattern.compile("[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]");
    private static final Pattern EMAIL = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,63}$", Pattern.CASE_INSENSITIVE);

    record Signup(String displayName, String username, String email, String password, String role) {}

    private AccountValidator() {}

    static Signup signup(Map<String, Object> body) {
        String displayName = text(body, "displayName").trim();
        String username = text(body, "username").trim().toLowerCase(Locale.ROOT);
        String email = text(body, "email").trim().toLowerCase(Locale.ROOT);
        String password = text(body, "password");
        String role = text(body, "role").trim().toUpperCase(Locale.ROOT);
        if (displayName.length() < 2 || displayName.length() > 100)
            throw new IllegalArgumentException("Display name must be between 2 and 100 characters");
        if (!USERNAME.matcher(username).matches())
            throw new IllegalArgumentException("Username must be 3-30 characters using letters, numbers, dots, dashes, or underscores");
        if (email.length() > 254 || !EMAIL.matcher(email).matches())
            throw new IllegalArgumentException("Enter a valid email address");
        validatePassword(password);
        if (!role.equals("VIEWER") && !role.equals("CREATOR"))
            throw new IllegalArgumentException("Account type must be viewer or creator");
        return new Signup(displayName, username, email, password, role);
    }

    static String identifier(Map<String, Object> body) {
        String value = text(body, "identifier").trim().toLowerCase(Locale.ROOT);
        if (value.isEmpty() || value.length() > 254) throw new IllegalArgumentException("Enter your email or username");
        return value;
    }

    static String loginPassword(Map<String, Object> body) {
        String value = text(body, "password");
        if (value.isEmpty() || value.length() > 128) throw new IllegalArgumentException("Enter your password");
        return value;
    }

    static void validatePassword(String password) {
        if (password.length() < 8 || password.length() > 128
                || password.chars().noneMatch(Character::isUpperCase)
                || password.chars().noneMatch(Character::isLowerCase)
                || password.chars().noneMatch(Character::isDigit))
            throw new IllegalArgumentException("Password must be 8-128 characters with uppercase, lowercase, and a number");
    }

    private static String text(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value instanceof String ? (String) value : "";
    }
}
