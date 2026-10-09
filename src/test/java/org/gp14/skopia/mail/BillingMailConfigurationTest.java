package org.gp14.skopia.mail;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BillingMailConfigurationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(BillingMailConfig.class, BillingMailDispatcher.class, SkopiaEmailTemplates.class, ExistingSender.class)
            .withBean(BillingMailOutboxRepository.class, () -> mock(BillingMailOutboxRepository.class))
            .withBean(BillingMailClaims.class, () -> mock(BillingMailClaims.class))
            .withPropertyValues("skopia.mail.enabled=true", "skopia.mail.host=mail.example.test",
                    "skopia.mail.port=587", "skopia.mail.username=user", "skopia.mail.password=test-only");

    @Configuration(proxyBeanMethods = false)
    static class ExistingSender {
        @Bean JavaMailSender unrelatedSender() { return mock(JavaMailSender.class); }
    }

    @Test void dedicatedAuthenticatedSenderIsUsedEvenWhenAnotherSenderExists() {
        runner.withPropertyValues("skopia.mail.from=sender@example.test").run(context -> {
            assertThat(context).hasNotFailed();
            var sender=(JavaMailSenderImpl)context.getBean("billingMailSender");
            assertThat(sender.getHost()).isEqualTo("mail.example.test");
            assertThat(sender.getJavaMailProperties()).containsEntry("mail.smtp.auth", "true")
                    .containsEntry("mail.smtp.starttls.required", "true")
                    .containsEntry("mail.smtp.ssl.checkserveridentity", "true");
            assertThat(ReflectionTestUtils.getField(context.getBean(BillingMailDispatcher.class), "sender"))
                    .isSameAs(sender).isNotSameAs(context.getBean("unrelatedSender"));
        });
    }

    @Test void malformedFromAddressesPreventStartup() {
        for (String from : new String[] {"not-an-address", "sender.@example.test", "name <sender@example.test>",
                "sender@example.test,another@example.test", "sender@example.test\r\nBcc:other@example.test"}) {
            runner.withPropertyValues("skopia.mail.from="+from).run(context ->
                    assertThat(context).hasFailed());
        }
    }
}
