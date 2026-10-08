package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.AdvertisingSessionResponse;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.model.user.StaffType;
import org.gp14.skopia.user.StaffRoleService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * What the advertising console is allowed to do, for whoever is signed in.
 *
 * <p>This used to take a handle as a query parameter and answer with that
 * account's id, because the frontend knew who was signed in by handle and the API
 * worked in numeric ids. Two things were wrong with it: a handle is not proof of
 * identity, so anyone could ask for anyone's id; and the answer told them which
 * handles hold advertising rights, which is a list worth having if you intend to
 * misuse one.
 *
 * <p>It now reports the caller and nobody else. The id comes from the bearer
 * token, so the question "who am I" has one possible answer and asking about
 * somebody else is not expressible.
 */
@RestController
@RequestMapping("/api/advertising")
public class AdvertisingSessionController {

    private final AdvertisingAccess access;
    private final StaffRoleService staffRoles;

    public AdvertisingSessionController(AdvertisingAccess access, StaffRoleService staffRoles) {
        this.access = access;
        this.staffRoles = staffRoles;
    }

    @GetMapping("/session")
    public AdvertisingSessionResponse session(@AuthenticationPrincipal User principal) {
        User user = access.require(AdvertisingAccess.idOf(principal));

        boolean isOfficer = staffRoles.hasRole(user.getId(), StaffType.MARKETING_OFFICER);
        return new AdvertisingSessionResponse(
                user.getId(),
                user.getUsername(),
                displayName(user),
                isOfficer ? "marketing officer" : "administrator",
                isOfficer);
    }

    private static String displayName(User user) {
        String first = user.getFirstName() == null ? "" : user.getFirstName();
        String last = user.getLastName() == null ? "" : user.getLastName();
        String full = (first + " " + last).trim();
        return full.isEmpty() ? user.getUsername() : full;
    }
}
