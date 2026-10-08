package org.gp14.skopia.user;

import org.gp14.skopia.advertising.AdvertisingSeedData;
import org.gp14.skopia.repository.*;
import org.gp14.skopia.security.PasswordService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DevelopmentSeedConfigurationTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(StaffSeedData.class, AdvertisingSeedData.class)
            .withBean(UserRepository.class, () -> mock(UserRepository.class))
            .withBean(SupportOfficerRepository.class, () -> mock(SupportOfficerRepository.class))
            .withBean(AdministratorRepository.class, () -> mock(AdministratorRepository.class))
            .withBean(MarketingOfficerRepository.class, () -> mock(MarketingOfficerRepository.class))
            .withBean(ContentCreatorRepository.class, () -> mock(ContentCreatorRepository.class))
            .withBean(CategoryRepository.class, () -> mock(CategoryRepository.class))
            .withBean(VideoRepository.class, () -> mock(VideoRepository.class))
            .withBean(AccessTierRepository.class, () -> mock(AccessTierRepository.class))
            .withBean(PasswordService.class, () -> mock(PasswordService.class));

    @Test
    void defaultAndProductionNeverRegisterDevelopmentSeedersEvenWithOptIn() {
        context.run(ctx -> assertThat(ctx.getBeansOfType(ApplicationRunner.class)).isEmpty());
        context.withPropertyValues("skopia.dev.seed-enabled=true")
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("prod"))
                .run(ctx -> assertThat(ctx.getBeansOfType(ApplicationRunner.class)).isEmpty());
        context.withPropertyValues("skopia.dev.seed-enabled=true")
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("prod", "dev"))
                .run(ctx -> assertThat(ctx.getBeansOfType(ApplicationRunner.class)).isEmpty());
    }

    @Test
    void developmentRequiresExplicitOptInAndTestProfileStillDisablesFixtures() {
        context.withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("dev"))
                .run(ctx -> assertThat(ctx.getBeansOfType(ApplicationRunner.class)).isEmpty());
        context.withPropertyValues("skopia.dev.seed-enabled=true")
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("dev", "test"))
                .run(ctx -> assertThat(ctx.getBeansOfType(ApplicationRunner.class)).isEmpty());
        context.withPropertyValues("skopia.dev.seed-enabled=true")
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("dev"))
                .run(ctx -> assertThat(ctx.getBeansOfType(ApplicationRunner.class)).hasSize(2));
    }
}
