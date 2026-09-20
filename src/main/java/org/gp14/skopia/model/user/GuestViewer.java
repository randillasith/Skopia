package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "guest_viewers")
@PrimaryKeyJoinColumn(name = "viewer_id")
@Getter
@Setter
@NoArgsConstructor
public class GuestViewer extends Viewer {

    @Column(name = "session_id", nullable = false, length = 100)
    private String sessionId;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "session_start", nullable = false)
    private LocalDateTime sessionStart;

    @PrePersist
    protected void onGuestCreate() {
        if (sessionStart == null) {
            sessionStart = LocalDateTime.now();
        }
    }
}
