package org.gp14.skopia.user;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="password_reset_tokens", indexes={@Index(name="idx_reset_user", columnList="user_id")})
public class PasswordResetToken {
    @Id @Column(name="token_digest", length=64) private String digest;
    @Column(name="user_id", nullable=false) private Long userId;
    @Column(name="expires_at", nullable=false) private Instant expiresAt;
    @Column(name="created_at", nullable=false) private Instant createdAt;
    @Column(name="consumed", nullable=false) private boolean consumed;
    protected PasswordResetToken() {}
    public PasswordResetToken(String digest, Long userId, Instant createdAt) {
        this.digest=digest; this.userId=userId; this.createdAt=createdAt; this.expiresAt=createdAt.plusSeconds(3600);
    }
    public String getDigest() { return digest; }
    public Long getUserId() { return userId; }
    public Instant getExpiresAt() { return expiresAt; }
    public boolean isConsumed() { return consumed; }
}
