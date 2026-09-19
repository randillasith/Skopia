package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "viewers")
@PrimaryKeyJoinColumn(name = "viewer_id")
@Getter
@Setter
@NoArgsConstructor
public class Viewer extends User {

    @Column(name = "preferred_language", length = 20)
    private String preferredLanguage = "en";

    @Column(name = "device_type", length = 50)
    private String deviceType;
}
