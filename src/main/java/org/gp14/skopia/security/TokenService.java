package org.gp14.skopia.security;

import org.springframework.beans.factory.annotation.Value;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.UserRepository;
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
    private final UserRepository users;

    public TokenService(@Value("${skopia.auth.secret}") String secret,
                        @Value("${skopia.auth.ttl-seconds:3600}") long ttlSeconds, UserRepository users) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("skopia.auth.secret must contain at least 32 characters");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlSeconds;
        this.clock = Clock.systemUTC();
        this.users = users;
    }

    public String issue(Long userId) {
        long version = users.findById(userId)
                .map(user -> user.getAuthVersion() == null ? 0L : user.getAuthVersion())
                .orElse(0L);
        String payload = userId + ":" + Instant.now(clock).plusSeconds(ttlSeconds).getEpochSecond() + ":" + version;
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
            if ((values.length != 2 && values.length != 3) || Long.parseLong(values[1]) <= Instant.now(clock).getEpochSecond()) return null;
            return Long.parseLong(values[0]);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    public boolean verifyForUser(String token, User user) {
        if(token==null || !user.getId().equals(verifyAndGetUserId(token))) return false;
        try {
            String payload=new String(Base64.getUrlDecoder().decode(token.split("\\.", -1)[0]), StandardCharsets.UTF_8);
            String[] parts=payload.split(":", -1);
            return (parts.length==2 ? 0L : Long.parseLong(parts[2]))==
                    (user.getAuthVersion()==null ? 0L : user.getAuthVersion());
        } catch(RuntimeException ex) { return false; }
    }

    /** Short-lived URL scoped to one media file and user. Does not expose the bearer token. */
    public String issueMedia(Long videoId, String filename, Long userId) {
        String payload = videoId + ":" + filename + ":" + userId + ":" + Instant.now(clock).plusSeconds(3600).getEpochSecond();
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return encoded + "." + sign(encoded);
    }

    public Long verifyMediaUser(String token, Long videoId, String filename) {
        if (token == null) return null;
        String[] parts = token.split("\\.", -1);
        if (parts.length != 2 || !MessageDigestSupport.constantEquals(sign(parts[0]), parts[1])) return null;
        try {
            String[] values = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8).split(":", -1);
            if (values.length != 4 || !Long.toString(videoId).equals(values[0]) || !filename.equals(values[1])
                    || Long.parseLong(values[3]) <= Instant.now(clock).getEpochSecond()) return null;
            return Long.parseLong(values[2]);
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
