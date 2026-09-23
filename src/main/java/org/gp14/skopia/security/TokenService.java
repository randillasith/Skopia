package org.gp14.skopia.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;

@Service
public class TokenService {
    private final byte[] secret;
    private final long ttlSeconds;
    private final Clock clock;

    public TokenService(@Value("${skopia.auth.secret}") String secret,
                        @Value("${skopia.auth.ttl-seconds:3600}") long ttlSeconds) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("skopia.auth.secret must contain at least 32 characters");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
        this.clock = Clock.systemUTC();
    }

    public String issue(Long userId) {
        String payload = userId + ":" + Instant.now(clock).plusSeconds(ttlSeconds).getEpochSecond();
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return encoded + "." + sign(encoded);
    }

    public Long verifyAndGetUserId(String token) {
        if (token == null) return null;
        String[] parts = token.split("\\.", -1);
        if (parts.length != 2 || !MessageDigestSupport.constantEquals(sign(parts[0]), parts[1])) return null;
        try {
            String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            String[] values = payload.split(":", -1);
            if (values.length != 2 || Long.parseLong(values[1]) <= Instant.now(clock).getEpochSecond()) return null;
            return Long.parseLong(values[0]);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to sign authentication token", ex);
        }
    }

    private static final class MessageDigestSupport {
        static boolean constantEquals(String left, String right) {
            return java.security.MessageDigest.isEqual(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
        }
    }
}
