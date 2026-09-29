package com.skopia;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

final class SessionStore {
    static final String COOKIE = "skopia_session";
    static final long MAX_AGE_SECONDS = Duration.ofDays(7).toSeconds();
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Entry> sessions = new ConcurrentHashMap<>();

    String create(long userId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        sessions.put(token, new Entry(userId, Instant.now().plusSeconds(MAX_AGE_SECONDS)));
        return token;
    }

    Long resolve(String token) {
        if (token == null || token.isBlank()) return null;
        Entry entry = sessions.get(token);
        if (entry == null) return null;
        if (entry.expiresAt().isBefore(Instant.now())) { sessions.remove(token); return null; }
        return entry.userId();
    }

    void revoke(String token) { if (token != null) sessions.remove(token); }

    static String tokenFrom(String cookieHeader) {
        if (cookieHeader == null) return null;
        for (String item : cookieHeader.split(";")) {
            String[] pair = item.trim().split("=", 2);
            if (pair.length == 2 && pair[0].equals(COOKIE)) return pair[1];
        }
        return null;
    }

    private record Entry(long userId, Instant expiresAt) {}
}
