package org.gp14.skopia.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken,String> {
    @Modifying
    @Query("update PasswordResetToken t set t.consumed = true where t.digest = :digest and t.consumed = false and t.expiresAt > :now")
    int consume(@Param("digest") String digest, @Param("now") Instant now);
    @Modifying
    @Query("update PasswordResetToken t set t.consumed = true where t.digest = :digest and t.consumed = false")
    int invalidate(@Param("digest") String digest);
    @Modifying
    @Query("update PasswordResetToken t set t.consumed = true where t.userId = :userId and t.consumed = false")
    int revokeForUser(@Param("userId") Long userId);
}
