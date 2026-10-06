package org.gp14.skopia.advertising;

import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.MarketingOfficer;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.model.video.AccessTier;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * The cast every FR5 test needs: an officer to act as, a title to advertise
 * against, and a viewer to show it to.
 *
 * <p>Seeded through the repositories rather than through SQL so the tests exercise
 * the same mappings the application does — a column the entity gets wrong should
 * fail here, not only in production.
 */
@Component
public class AdvertisingFixture {

    @Autowired MarketingOfficerRepository officers;
    @Autowired AdministratorRepository administrators;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired UserRepository users;
    @Autowired CategoryRepository categories;
    @Autowired VideoRepository videos;
    @Autowired AccessTierRepository tiers;

    private int seq = 0;

    public MarketingOfficer officer() {
        MarketingOfficer officer = new MarketingOfficer();
        stampUser(officer, "officer");
        officer.setDesignation("Marketing Officer");
        officer.setHireDate(LocalDate.of(2026, 1, 5));
        officer.setOfficerCode("MKT-" + (++seq));
        officer.setDepartment("Advertising");
        return officers.save(officer);
    }

    public Administrator administrator() {
        Administrator admin = new Administrator();
        stampUser(admin, "admin");
        admin.setDesignation("Administrator");
        admin.setHireDate(LocalDate.of(2026, 1, 5));
        admin.setAdminLevel("FULL");
        return administrators.save(admin);
    }

    /** An account with no staff grant. The one FR5 must refuse. */
    public RegisteredViewer viewer() {
        RegisteredViewer viewer = new RegisteredViewer();
        stampUser(viewer, "viewer");
        viewer.setDisplayName("A Viewer");
        viewer.setJoinDate(LocalDateTime.now());
        viewer.setIsPremium(false);
        return viewers.save(viewer);
    }

    public Category category(String name) {
        Category category = new Category();
        category.setCategoryName(name);
        category.setCategoryDesc(name + " titles");
        return categories.save(category);
    }

    public Video video(String title, Category category) {
        AccessTier tier = tiers.findAll().stream().findFirst().orElseGet(() -> {
            AccessTier created = new AccessTier();
            created.setTierName("Free");
            return tiers.save(created);
        });
        Video video = new Video();
        video.setTitle(title);
        video.setCategory(category);
        video.setAccessTier(tier);
        video.setDuration(1800);
        video.setUploadDate(LocalDateTime.now().minusDays(7));
        video.setVideoStatus("PUBLIC");
        video.setViewCount(0L);
        return videos.save(video);
    }

    private void stampUser(org.gp14.skopia.model.user.User user, String kind) {
        int n = ++seq;
        user.setUsername(kind + n);
        user.setEmail(kind + n + "@skopia.test");
        user.setPasswordHash("x");
        user.setFirstName(kind.substring(0, 1).toUpperCase() + kind.substring(1));
        user.setLastName("Number " + n);
        user.setAccountStatus("ACTIVE");
        user.setRegisteredDate(LocalDateTime.now());
    }
}
