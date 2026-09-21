package org.gp14.skopia.advertising;

import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.MarketingOfficer;
import org.gp14.skopia.model.video.AccessTier;
import org.gp14.skopia.model.video.Category;
import org.gp14.skopia.model.video.Video;
import org.gp14.skopia.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Enough of the platform for the advertising console to be usable on a fresh
 * database.
 *
 * <p>FR5 sits on top of three things other features own: a marketing officer to
 * act as, categories to target, and titles to target. On a database that has none
 * of them, every advertising screen opens empty and the module looks broken when
 * it is only unseeded.
 *
 * <p>Two rules keep this from becoming fake data nobody asked for. It writes
 * nothing that already exists — one officer with an existing handle, or a single
 * category, and the whole seeder stands down. And it is off outside development:
 * {@code @Profile("!prod")} plus the emptiness checks mean a real deployment with a
 * real catalogue never sees it.
 *
 * <p>The marketing officer's handle matches the prototype's own advertising
 * identity, so signing in as that account in the UI resolves to this row through
 * {@link AdvertisingSessionController}.
 */
@Configuration
@Profile("!prod & !test")
public class AdvertisingSeedData {

    private static final Logger log = LoggerFactory.getLogger(AdvertisingSeedData.class);

    /** Mirrors {@code STAFF_ROLES.marketing} in the frontend's session model. */
    private static final String OFFICER_HANDLE = "m.madhusara";

    private static final List<String> CATEGORIES = List.of(
            "Documentary", "Short Film", "Series", "Talk", "Music", "Learning");

    /** title → category, so targeting has something real to choose between. */
    private static final List<String[]> TITLES = List.of(
            new String[] { "The Long Exposure", "Documentary" },
            new String[] { "Salt and Iron", "Short Film" },
            new String[] { "Understory", "Documentary" },
            new String[] { "Night Kitchen", "Series" },
            new String[] { "Cadence Hall Live", "Music" },
            new String[] { "Reading the Weather", "Learning" });

    @Bean
    ApplicationRunner seedAdvertisingPrerequisites(UserRepository users,
                                                   MarketingOfficerRepository officers,
                                                   ContentCreatorRepository creators,
                                                   CategoryRepository categories,
                                                   VideoRepository videos,
                                                   AccessTierRepository tiers) {
        return args -> {
            seedOfficer(users, officers);
            seedCatalogue(users, creators, categories, videos, tiers);
        };
    }

    private ContentCreator newCreator(UserRepository users, ContentCreatorRepository creators) {
        String handle = "meridian";
        if (users.existsByUsername(handle)) {
            return creators.findAll().stream().findFirst().orElseThrow();
        }
        ContentCreator creator = new ContentCreator();
        creator.setUsername(handle);
        creator.setEmail(handle + "@skopia.test");
        creator.setPasswordHash("skopia");
        creator.setFirstName("Meridian");
        creator.setLastName("Films");
        creator.setAccountStatus("ACTIVE");
        creator.setRegisteredDate(LocalDateTime.now());
        creator.setChannelName("Meridian Films");
        creator.setChannelBio("Seeded so advertising has a programme to run against.");
        creator.setIsVerified(true);
        creator.setTotalUploads(TITLES.size());
        return creators.save(creator);
    }

    private void seedOfficer(UserRepository users, MarketingOfficerRepository officers) {
        if (users.existsByUsername(OFFICER_HANDLE)) {
            return;
        }
        MarketingOfficer officer = new MarketingOfficer();
        officer.setUsername(OFFICER_HANDLE);
        officer.setEmail(OFFICER_HANDLE + "@skopia.test");
        // Development credentials only; AuthController accepts a plain-text match.
        officer.setPasswordHash("skopia");
        officer.setFirstName("Madhusara");
        officer.setLastName("J. P. M.");
        officer.setAccountStatus("ACTIVE");
        officer.setRegisteredDate(LocalDateTime.now());
        officer.setDesignation("Marketing Officer");
        officer.setHireDate(LocalDate.of(2026, 3, 20));
        officer.setOfficerCode("MKT-001");
        officer.setDepartment("Advertising");
        officers.save(officer);
        log.info("FR5 seed: created marketing officer @{}", OFFICER_HANDLE);
    }

    /**
     * Categories and titles, but only onto an empty catalogue.
     *
     * <p>Content is FR-Video-Content's to own. The moment that feature has seeded
     * or a creator has uploaded anything, this does nothing at all.
     */
    private void seedCatalogue(UserRepository users, ContentCreatorRepository creators,
                               CategoryRepository categories, VideoRepository videos,
                               AccessTierRepository tiers) {
        if (categories.count() > 0 || videos.count() > 0) {
            return;
        }

        // A title needs a creator, and not only for display: VideoService's
        // catalogue query reaches through v.creator.id, which inner-joins, so a
        // creatorless video is invisible to browse and therefore to advertising.
        ContentCreator creator = creators.findAll().stream().findFirst()
                .orElseGet(() -> newCreator(users, creators));

        AccessTier free = tiers.findAll().stream().findFirst().orElseGet(() -> {
            AccessTier tier = new AccessTier();
            tier.setTierName("Free");
            tier.setTierDesc("Available without a pass");
            return tiers.save(tier);
        });

        for (String name : CATEGORIES) {
            Category category = new Category();
            category.setCategoryName(name);
            category.setCategoryDesc(name + " titles");
            categories.save(category);
        }

        for (String[] entry : TITLES) {
            Category category = categories.findByCategoryName(entry[1]).orElse(null);
            Video video = new Video();
            video.setTitle(entry[0]);
            video.setCreator(creator);
            video.setCategory(category);
            video.setAccessTier(free);
            video.setDescription("Seeded so advertising targeting has something to choose.");
            video.setDuration(1_800);
            video.setUploadDate(LocalDateTime.now().minusDays(20));
            // "PUBLISHED", not the entity's "PUBLIC" default: VideoService filters
            // the public catalogue on this exact word, and a seeded title nobody
            // can browse to is a title no advertisement can be shown against.
            video.setVideoStatus("PUBLISHED");
            video.setViewCount(0L);
            videos.save(video);
        }
        log.info("FR5 seed: created {} categories and {} titles for targeting",
                CATEGORIES.size(), TITLES.size());
    }
}
