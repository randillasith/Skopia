package org.gp14.skopia.model.video;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "access_tiers")
@Getter
@Setter
@NoArgsConstructor
public class AccessTier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tier_id")
    private Long id;

    @Column(name = "tier_name", nullable = false, unique = true, length = 50)
    private String tierName;

    @Column(name = "tier_desc", length = 255)
    private String tierDesc;
}
