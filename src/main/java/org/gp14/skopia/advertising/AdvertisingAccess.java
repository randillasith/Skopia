package org.gp14.skopia.advertising;

import org.gp14.skopia.model.user.StaffType;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.user.StaffRoleService;
import org.springframework.stereotype.Component;

/**
 * Who is allowed to work on advertising, and as whom.
 *
 * <p>The caller is the account behind the request's bearer token, resolved by
 * {@code BearerTokenFilter} into the Spring Security principal. It used to be
 * whatever number the client put in an {@code X-User-Id} header, which meant the
 * entire advertising API was protected by a guessable integer: sending
 * {@code X-User-Id: 1} was enough to create campaigns in a marketing officer's
 * name. Nothing here reads that header any more.
 *
 * <p>The filter chain already refuses the wrong role before a controller runs.
 * These checks stay as the second line: they are what a service call that did not
 * come through the chain still has to pass, and they explain the refusal in
 * words the console can show.
 *
 * <p>Two roles pass: a marketing officer, and an administrator (who reaches every
 * staff console). A campaign is always attributed to a marketing officer, so an
 * administrator acting alone cannot create one — {@link #actingOfficer} says so
 * plainly instead of attributing the work to whoever happens to be first in the
 * table.
 */
@Component
public class AdvertisingAccess {

    private final UserRepository users;
    private final StaffRoleService staffRoles;

    public AdvertisingAccess(UserRepository users, StaffRoleService staffRoles) {
        this.users = users;
        this.staffRoles = staffRoles;
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
        if (staffRoles.hasRole(actorId, StaffType.MARKETING_OFFICER)
                || staffRoles.hasRole(actorId, StaffType.ADMINISTRATOR)) {
            return user;
        }
        throw AdvertisingException.forbidden(
                "Managing advertising is granted by an administrator. This account does not hold it.");
    }

    /**
     * The marketing officer a new campaign is attributed to.
     *
     * <p>Separate from {@link #require} because reading campaigns is open to both
     * roles while owning one is not. Campaign ownership points at the base user
     * so a composed staff grant can own a booking without corrupting JOINED user
     * inheritance; administrators still cannot create a booking themselves.
     */
    public User actingOfficer(Long actorId) {
        User user = require(actorId);
        if (!staffRoles.hasRole(actorId, StaffType.MARKETING_OFFICER)) throw AdvertisingException.forbidden(
                "Only a marketing officer can own a campaign. "
                        + "An administrator can grant that role, but cannot hold the booking.");
        return user;
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

    /**
     * The id behind an authenticated principal, or null when there is nobody.
     *
     * <p>Null reaches {@link #require} and comes back as a 401 with something to
     * read, which is friendlier than the filter chain's bare status for the few
     * paths that are open to anonymous callers and check afterwards.
     */
    public static Long idOf(User principal) {
        return principal == null ? null : principal.getId();
    }

    /**
     * Refuse a caller who did not book this campaign.
     *
     * <p>Holding the marketing role says you may run advertising; it does not say
     * you may edit somebody else's booking. An administrator is exempt, because
     * clearing up after a departed officer is exactly their job.
     */
    public void requireOwner(Long actorId, Long ownerId, String what) {
        if (staffRoles.hasRole(actorId, StaffType.ADMINISTRATOR)) {
            return;
        }
        if (ownerId == null || !ownerId.equals(actorId)) {
            throw AdvertisingException.forbidden(
                    "This " + what + " belongs to another marketing officer. "
                            + "An administrator can act on it; a colleague cannot.");
        }
    }
}
