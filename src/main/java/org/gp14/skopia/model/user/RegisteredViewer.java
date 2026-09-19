package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "registered_viewers")
@PrimaryKeyJoinColumn(name = "viewer_id")
@Getter
@Setter
@NoArgsConstructor
public class RegisteredViewer extends Viewer {

    @Column(length = 255)
    private String street;

    @Column(length = 100)
    private String city;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(name = "join_date", nullable = false)
    private LocalDateTime joinDate;

    @Column(name = "contact_no", length = 30)
    private String contactNo;

    @Column(name = "notify_channel", length = 50)
    private String notifyChannel = "EMAIL";

    @Column(name = "is_premium", nullable = false)
    private Boolean isPremium = false;

    @PrePersist
    protected void onRegCreate() {
        if (joinDate == null) {
            joinDate = LocalDateTime.now();
        }
    }
}
