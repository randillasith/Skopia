package org.gp14.skopia.mail;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class SkopiaEmailTemplatesTest {
    final SkopiaEmailTemplates templates=new SkopiaEmailTemplates("https://app.example.test");
    static String receipt(String ref) {
        return "Skopia simulated subscription payment receipt\n\nOrder reference: "+ref
                +"\nPayment ID: 77\nPlan: MONTHLY\nSimulated payment: LKR 500.00\nStarts: 2026-10-08T12:00\nEnds: 2026-11-07T12:00\n";
    }
    static String refund(String status) {
        return "Skopia simulated refund status\n\nRefund ID: 91\nPayment ID: 77\nStatus: "+status
                +"\nCategory: ACCIDENTAL_PURCHASE\nAmount: LKR 500.00\nReason: hidden free text\nDecision note: hidden admin text\n";
    }
    @Test void welcomeUsesProvidedDesignEscapesEmailAndLinksToApp() {
        String email="viewer+welcome@example.test";
        String html=templates.welcome(email);
        assertThat(html).contains("Welcome to Skopia", "Watch Beyond Limits", "Start watching", email,
                "href=\"https://app.example.test/\"", "href=\"https://app.example.test/login\"",
                "https://app.example.test/skopia-logo.png");
        assertThat(html).doesNotContain("{{", "skopia.randillasith.me");
        assertThatThrownBy(()->templates.welcome("bad@example.test<svg/onload=alert(1)>")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void paymentUsesProvidedBrandDesignAndEscapesDynamicContent() {
        String html=templates.billing("DEMO_PAYMENT_RECEIPT:1",receipt("<img src=x onerror='alert(1)'>&")).orElseThrow();
        assertThat(html).contains("Payment receipt", "Watch Beyond Limits", "LKR 500.00", "MONTHLY", "no real charge", "https://app.example.test/billing");
        assertThat(html).contains("&lt;img", "&amp;");
        assertThat(html).doesNotContain("<img src=x", "{{", "skopia.randillasith.me");
    }
    @Test void everyRefundStateHasSafeServerColorNoteAndCorrectLinks() {
        for(String status:new String[]{"PENDING","APPROVED","REJECTED","CANCELLED"}) {
            String html=templates.billing("REFUND_"+status+":91",refund(status)).orElseThrow();
            assertThat(html).contains("Refund status update", "LKR 500.00", status, "ACCIDENTAL PURCHASE", "https://app.example.test/billing");
            assertThat(html).doesNotContain("{{", "hidden free text", "hidden admin text");
            if(status.equals("APPROVED")) assertThat(html).contains("#16c784", "pass has ended");
            if(status.equals("REJECTED")) assertThat(html).contains("#f63d68", "rejected this request");
        }
    }
    @Test void resetTemplateUsesCanonicalFragmentTwiceAndOneHourExpiry() {
        String token="t".repeat(43); String url="https://reset.example.test/reset/confirm#token="+token;
        String html=templates.passwordReset(url);
        assertThat(html).contains("href=\""+url+"\"", url, "1 hour", "https://reset.example.test/skopia-logo.png");
        assertThat(html).doesNotContain("{{", "?token=", "app.example.test");
    }
    @Test void rejectsUnsafeOriginsOrResetUrls() {
        for(String origin:new String[]{"http://example.test","https://example.test/path","https://user@example.test","https://example.test?redirect=x"})
            assertThatThrownBy(()->new SkopiaEmailTemplates(origin)).isInstanceOf(IllegalArgumentException.class);
        for(String url:new String[]{"javascript:alert(1)","https://example.test/reset/confirm?token="+"t".repeat(43),"https://example.test/reset/confirm#token=bad"})
            assertThatThrownBy(()->templates.passwordReset(url)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void oldOrMalformedOutboxMessagesRetainPlainTextFallback() {
        assertThat(templates.billing("COMP_RECEIPT:1","old receipt")).isEmpty();
        assertThat(templates.billing("DEMO_PAYMENT_RECEIPT:1","no details")).isEmpty();
        assertThat(templates.billing("REFUND_PENDING:91",refund("APPROVED"))).isEmpty();
        assertThat(templates.billing("REFUND_PENDING:91",refund("javascript:alert(1)"))).isEmpty();
        String old=refund("PENDING").replace("Payment ID: 77\n","");
        assertThat(templates.billing("REFUND_PENDING:91",old).orElseThrow()).contains("See billing history");
    }
    @Test void exportSyntheticPreviewsOnlyWhenExplicitlyRequested() throws Exception {
        String destination=System.getProperty("skopia.email.preview-dir");
        if(destination==null) return;
        var dir=java.nio.file.Path.of(destination); java.nio.file.Files.createDirectories(dir);
        java.nio.file.Files.writeString(dir.resolve("welcome.html"),templates.welcome("welcome-preview@example.test"));
        java.nio.file.Files.writeString(dir.resolve("payment-receipt.html"),templates.billing("DEMO_PAYMENT_RECEIPT:1",receipt("SIM-DEMO-PREVIEW-77")).orElseThrow());
        java.nio.file.Files.writeString(dir.resolve("password-reset.html"),templates.passwordReset("https://app.example.test/reset/confirm#token="+"t".repeat(43)));
        for(String status:new String[]{"PENDING","APPROVED","REJECTED","CANCELLED"})
            java.nio.file.Files.writeString(dir.resolve("refund-"+status.toLowerCase(java.util.Locale.ROOT)+".html"),templates.billing("REFUND_"+status+":91",refund(status)).orElseThrow());
    }
    @Test void producesUtf8MultipartAlternativeWithUnmodifiedPlainFallback() {
        var sender=org.mockito.Mockito.mock(org.springframework.mail.javamail.JavaMailSender.class);
        String plain=receipt("SIM-DEMO-77");
        SkopiaMailMessage.send(sender,"sender@example.test","viewer@example.test","Receipt — demo",plain,templates.billing("DEMO_PAYMENT_RECEIPT:1",plain).orElseThrow());
        var captured=org.mockito.ArgumentCaptor.forClass(jakarta.mail.internet.MimeMessage.class);
        org.mockito.Mockito.verify(sender).send(captured.capture());
        assertThat(MailParts.plain(captured.getValue())).isEqualTo(plain);
        assertThat(MailParts.html(captured.getValue())).contains("Payment receipt", "LKR 500.00");
    }
}
