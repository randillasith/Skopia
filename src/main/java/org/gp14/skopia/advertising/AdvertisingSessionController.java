package org.gp14.skopia.advertising;

import org.gp14.skopia.advertising.dto.AdvertisingSessionResponse;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.AdministratorRepository;
import org.gp14.skopia.repository.MarketingOfficerRepository;
import org.gp14.skopia.repository.UserRepository;
import org.springframework.web.bind.annotation.*;

/**
 * Binds a signed-in account to the numeric id the advertising API works in.
 *
 * <p>The frontend knows who is signed in by handle; every FR5 endpoint identifies
 * its caller by {@code X-User-Id}. Something has to turn one into the other, and
 * doing it here — once, behind the same {@link AdvertisingAccess} check the rest of
 * the module uses — is better than teaching every screen to guess.
 *
 * <p><strong>Known limitation.</strong> A handle is not proof of identity. Skopia
 * has no session store or token validation yet: {@code /api/auth/login} issues a
 * token nobody checks, and every endpoint on the platform already trusts a
 * caller-supplied user id. This endpoint is exactly as strong as that, and no
 * stronger. When real authentication lands, this should read the authenticated
 * principal instead of a query parameter, and {@code X-User-Id} should stop being
 * trusted across the whole API — not only here. Documented in
 * {@code docs/fr5/README.md}.
 */
@RestController
@RequestMapping("/api/advertising")
@CrossOrigin(origins = "*", maxAge = 3600)
public class AdvertisingSessionController {

    private final UserRepository users;
    private final MarketingOfficerRepository officers;
    private final AdministratorRepository administrators;
    private final AdvertisingAccess access;

    public AdvertisingSessionController(UserRepository users,
                                        MarketingOfficerRepository officers,
                                        AdministratorRepository administrators,
                                        AdvertisingAccess access) {
        this.users = users;
        this.officers = officers;
        this.administrators = administrators;
        this.access = access;
    }

    @GetMapping("/session")
    public AdvertisingSessionResponse session(@RequestParam String handle) {
        String clean = handle.startsWith("@") ? handle.substring(1).trim() : handle.trim();
        User user = users.findByUsername(clean)
                .orElseThrow(() -> AdvertisingException.forbidden(
                        "No Skopia account with the handle @" + clean + "."));

        access.require(user.getId());

        boolean isOfficer = officers.existsById(user.getId());
        return new AdvertisingSessionResponse(
                user.getId(),
                clean,
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
