package com.skopia;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

final class PasswordSecurity {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int ITERATIONS = 210_000;
    private static final int KEY_BITS = 256;

    private PasswordSecurity() {}

    static String hash(String password) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        byte[] derived = derive(password.toCharArray(), salt, ITERATIONS);
        return "pbkdf2-sha256$" + ITERATIONS + "$" + Base64.getUrlEncoder().withoutPadding().encodeToString(salt)
                + "$" + Base64.getUrlEncoder().withoutPadding().encodeToString(derived);
    }

    static boolean verify(String password, String stored) {
        try {
            String[] parts = stored == null ? new String[0] : stored.split("\\$");
            if (parts.length != 4 || !parts[0].equals("pbkdf2-sha256")) return false;
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getUrlDecoder().decode(parts[2]);
            byte[] expected = Base64.getUrlDecoder().decode(parts[3]);
            return MessageDigest.isEqual(expected, derive(password.toCharArray(), salt, iterations));
        } catch (RuntimeException e) {
            return false;
        }
    }

    private static byte[] derive(char[] password, byte[] salt, int iterations) {
        PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, KEY_BITS);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("Password hashing is unavailable", e);
        } finally {
            spec.clearPassword();
        }
    }
}
