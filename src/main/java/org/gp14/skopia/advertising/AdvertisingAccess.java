package org.gp14.skopia.advertising;

import org.gp14.skopia.model.user.MarketingOfficer;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.AdministratorRepository;
import org.gp14.skopia.repository.MarketingOfficerRepository;
import org.gp14.skopia.repository.UserRepository;
import org.springframework.stereotype.Component;

/**
 * Who is allowed to work on advertising, and as whom.
 *
 * <p>Skopia has no Spring Security filter chain — the platform authenticates by
 * passing the signed-in user's id with the request — so FR5 enforces its own rule
 * on top of that same convention rather than inventing a second one. Every
 * management endpoint resolves its caller here first; the serving and logging
 * endpoints deliberately do not, because viewers are the ones hitting those.
 *
 * <p>Two roles pass: a marketing officer, and an administrator (who reaches every
 * staff console). A campaign is always attributed to a marketing officer, so an
 * administrator acting alone cannot create one — {@link #actingOfficer} says so
 * plainly instead of attributing the work to whoever happens to be first in the
 * table.
 */
@Component
public class AdvertisingAccess {

    /** The header the frontend sends. Matches the rest of the platform's calls. */
    public static final String ACTOR_HEADER = "X-User-Id";

    private final UserRepository users;
    private final MarketingOfficerRepository officers;
    private final AdministratorRepository administrators;

    public AdvertisingAccess(UserRepository users,
                             MarketingOfficerRepository officers,
                             AdministratorRepository administrators) {
        this.users = users;
        this.officers = officers;
        this.administrators = administrators;
    }

    /**
     * Check the caller may manage advertising, and return them.
     *
     * @throws AdvertisingException 401 when nobody is identified, 403 when they are
     *                              identified but hold neither role.
     */
    public User require(Long actorId) {
        if (actorId == null) {
            throw new AdvertisingException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "Sign in as a marketing officer to manage advertising.");
        }
        User user = users.findById(actorId).orElseThrow(() -> AdvertisingException.forbidden(
                "That account no longer exists."));
        if (!"ACTIVE".equalsIgnoreCase(user.getAccountStatus())) {
            throw AdvertisingException.forbidden(
                    "This account is " + user.getAccountStatus().toLowerCase() + " and cannot manage advertising.");
        }
        if (officers.existsById(actorId) || administrators.existsById(actorId)) {
            return user;
        }
        throw AdvertisingException.forbidden(
                "Managing advertising is granted by an administrator. This account does not hold it.");
    }

    /**
     * The marketing officer a new campaign is attributed to.
     *
     * <p>Separate from {@link #require} because reading campaigns is open to both
     * roles while owning one is not: {@code ad_campaigns.created_by} points at
     * {@code marketing_officers}, and an administrator has no row there.
     */
    public MarketingOfficer actingOfficer(Long actorId) {
        require(actorId);
        return officers.findById(actorId).orElseThrow(() -> AdvertisingException.forbidden(
                "Only a marketing officer can own a campaign. "
                        + "An administrator can grant that role, but cannot hold the booking."));
    }

    /** True when the caller may manage advertising, without throwing. */
    public boolean canManage(Long actorId) {
        try {
            require(actorId);
            return true;
        } catch (AdvertisingException e) {
            return false;
        }
    }
}
