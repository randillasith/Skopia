package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Inheritance(strategy = InheritanceType.JOINED)
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "first_name", length = 50)
    private String firstName;

    @Column(name = "last_name", length = 50)
    private String lastName;

    @Column(name = "registered_date", nullable = false, updatable = false)
    private LocalDateTime registeredDate;

    @Column(name = "account_status", nullable = false, length = 20)
    private String accountStatus = "ACTIVE";

    @PrePersist
    protected void onCreate() {
        if (registeredDate == null) {
            registeredDate = LocalDateTime.now();
        }
    }
}
