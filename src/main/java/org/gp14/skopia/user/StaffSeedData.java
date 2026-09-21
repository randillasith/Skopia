package org.gp14.skopia.user;

import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.SupportOfficer;
import org.gp14.skopia.repository.AdministratorRepository;
import org.gp14.skopia.repository.SupportOfficerRepository;
import org.gp14.skopia.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A support officer and an administrator, so their consoles can be opened.
 *
 * <p>Nothing creates a staff account. Registration only ever makes a viewer or a
 * content creator — correctly, because a platform role is something an
 * administrator grants, not something you can give yourself by signing up. The
 * consequence on a fresh database is that the complaint queue and the
 * administration console cannot be reached by anybody at all, which makes two
 * working features look unbuilt.
 *
 * <p>This is the same device {@code AdvertisingSeedData} uses for the marketing
 * officer, under the same two rules: it writes nothing that already exists, and
 * it is off outside development. It is a way in for development and for a
 * demonstration; it is not a substitute for the grant flow, which is still
 * missing and is noted in the wiring notes.
 *
 * <p>The handles match the prototype's own staff identities, so signing in as
 * one lands in the console that identity was written for.
 */
@Configuration
@Profile("!prod & !test")
public class StaffSeedData {

    private static final Logger log = LoggerFactory.getLogger(StaffSeedData.class);

    /** Mirror STAFF_ROLES.support and STAFF_ROLES.admin in the frontend's session model. */
    private static final String SUPPORT_HANDLE = "k.laknadi";
    private static final String ADMIN_HANDLE = "p.punsara";

    /** Development credentials only; AuthController accepts a plain-text match. */
    private static final String PASSWORD = "skopia";

    @Bean
    ApplicationRunner seedStaff(UserRepository users,
                                SupportOfficerRepository supportOfficers,
                                AdministratorRepository administrators) {
        return args -> {
            if (!users.existsByUsername(SUPPORT_HANDLE)) {
                SupportOfficer officer = new SupportOfficer();
                officer.setUsername(SUPPORT_HANDLE);
                officer.setEmail(SUPPORT_HANDLE + "@skopia.test");
                officer.setPasswordHash(PASSWORD);
                officer.setFirstName("Laknadi");
                officer.setLastName("K. S. S.");
                officer.setAccountStatus("ACTIVE");
                officer.setRegisteredDate(LocalDateTime.now());
                officer.setDesignation("Support Officer");
                officer.setHireDate(LocalDate.of(2026, 2, 11));
                officer.setSupportLevel("L1");
                officer.setShift("Day");
                supportOfficers.save(officer);
                log.info("Staff seed: created support officer @{}", SUPPORT_HANDLE);
            }

            if (!users.existsByUsername(ADMIN_HANDLE)) {
                Administrator admin = new Administrator();
                admin.setUsername(ADMIN_HANDLE);
                admin.setEmail(ADMIN_HANDLE + "@skopia.test");
                admin.setPasswordHash(PASSWORD);
                admin.setFirstName("Punsara");
                admin.setLastName("P. S.");
                admin.setAccountStatus("ACTIVE");
                admin.setRegisteredDate(LocalDateTime.now());
                admin.setDesignation("Platform Administrator");
                admin.setHireDate(LocalDate.of(2026, 2, 11));
                admin.setAdminLevel("SUPER");
                administrators.save(admin);
                log.info("Staff seed: created administrator @{}", ADMIN_HANDLE);
            }
        };
    }
}
