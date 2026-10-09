package org.gp14.skopia.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.RegisteredViewerRepository;
import org.gp14.skopia.security.PasswordService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import jakarta.mail.internet.MimeMessage;
import org.gp14.skopia.mail.MailParts;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties={"skopia.mail.enabled=true", "skopia.mail.host=localhost", "skopia.mail.username=test", "skopia.mail.password=test", "skopia.mail.from=notifications@example.test", "skopia.password-reset.public-origin=https://app.example.test"})
class PasswordResetIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired RegisteredViewerRepository viewers;
    @Autowired PasswordService passwords;
    @Autowired PasswordResetService resets;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @MockBean(name="billingMailSender") JavaMailSender sender;
    ObjectMapper json = new ObjectMapper();

    private RegisteredViewer account(String status) {
        String id = UUID.randomUUID().toString().replace("-", "");
        RegisteredViewer user = new RegisteredViewer();
        user.setUsername("reset_" + id); user.setEmail(id + "@example.test");
        user.setPasswordHash(passwords.encode("original-pass")); user.setAccountStatus(status);
        user.setPreferredLanguage("en"); user.setIsPremium(false); user.setNotifyChannel("EMAIL");
        return viewers.saveAndFlush(user);
    }
    private String request(String email, String ip) throws Exception {
        return mvc.perform(post("/api/auth/password-reset/request").with(r -> { r.setRemoteAddr(ip); return r; })
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(java.util.Map.of("email",email))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }
    private String token() {
        var capture = org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender, timeout(5000).atLeastOnce()).send(capture.capture());
        String text = MailParts.plain(capture.getAllValues().get(capture.getAllValues().size()-1));
        var matcher = Pattern.compile("https://app\\.example\\.test/reset/confirm#token=([A-Za-z0-9_-]+)").matcher(text);
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }
    private void confirm(String token, String password, int status) throws Exception {
        mvc.perform(post("/api/auth/password-reset/confirm").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("token",token,"newPassword",password))))
                .andExpect(status().is(status));
    }
    @Test void brandedMultipartResetRetainsFragmentAndNeverPersistsLink() throws Exception {
        clearInvocations(sender);
        RegisteredViewer user=account("ACTIVE"); request(user.getEmail(),"192.0.2.81");
        var capture=org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender,timeout(5000)).send(capture.capture());
        var message=capture.getValue(); String html=MailParts.html(message), plain=MailParts.plain(message);
        assertThat(message.getContentType()).startsWith("multipart/");
        assertThat(html).contains("Reset your password", "Watch Beyond Limits", "1 hour", "https://app.example.test/skopia-logo.png");
        assertThat(html).doesNotContain("{{", "?token=", "javascript:");
        var matcher=Pattern.compile("https://app\\.example\\.test/reset/confirm#token=([A-Za-z0-9_-]{43})").matcher(plain);
        assertThat(matcher.find()).isTrue(); String token=matcher.group(1);
        assertThat(html).contains("href=\"https://app.example.test/reset/confirm#token="+token+"\"");
        assertThat(jdbc.queryForObject("select count(*) from billing_mail_outbox where body like ?",Integer.class,"%"+token+"%")).isZero();
        confirm(token,"template-new-password",200); confirm(token,"another-new-password",400);
    }
    @Test void genericResponsesInactiveFloodAndMailFailure() throws Exception {
        clearInvocations(sender);
        RegisteredViewer active = account("ACTIVE"), inactive = account("SUSPENDED");
        String a = request(active.getEmail(), "192.0.2.21");
        assertThat(request("missing"+UUID.randomUUID()+"@example.test", "192.0.2.22")).isEqualTo(a);
        assertThat(request(inactive.getEmail(), "192.0.2.23")).isEqualTo(a);
        verify(sender, timeout(5000).times(1)).send(any(MimeMessage.class));
        for(int i=0;i<8;i++) assertThat(request(active.getEmail(), "192.0.2.21")).isEqualTo(a);
        verify(sender, times(1)).send(any(MimeMessage.class));
        doThrow(new org.springframework.mail.MailSendException("SMTP failed")).when(sender).send(any(MimeMessage.class));
        RegisteredViewer failed=account("ACTIVE");
        assertThat(request(failed.getEmail(), "192.0.2.24")).isEqualTo(a);
        var failedCapture=org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender,timeout(5000).times(2)).send(failedCapture.capture());
        String failedText=MailParts.plain(failedCapture.getAllValues().get(1));
        var failedMatcher=Pattern.compile("#token=([A-Za-z0-9_-]+)").matcher(failedText);
        assertThat(failedMatcher.find()).isTrue();
        String failedToken=failedMatcher.group(1);
        String digest=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(failedToken.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        for(int i=0;i<100 && !jdbc.queryForObject("select consumed from password_reset_tokens where token_digest=?",Boolean.class,digest);i++)
            Thread.sleep(10);
        confirm(failedToken,"another-new-pass",400);
        assertThat(passwords.matches("original-pass",viewers.findById(failed.getId()).orElseThrow().getPasswordHash())).isTrue();
    }
    @Test void legacyNullAuthVersionLoginWorksUntilResetThenNewLoginWorks() throws Exception {
        clearInvocations(sender);
        RegisteredViewer user = account("ACTIVE");
        jdbc.update("update users set auth_version=null where user_id=?", user.getId());
        assertThat(jdbc.queryForObject("select auth_version from users where user_id=?", Long.class, user.getId())).isNull();
        String login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("identifier", user.getEmail(), "password", "original-pass"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String oldBearer = json.readTree(login).get("token").asText();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + oldBearer)).andExpect(status().isOk());
        request(user.getEmail(), "192.0.2.32");
        confirm(token(), "different-new-pass", 200);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + oldBearer)).andExpect(status().isUnauthorized());
        String newLogin = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("identifier", user.getEmail(), "password", "different-new-pass"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + json.readTree(newLogin).get("token").asText()))
                .andExpect(status().isOk());
    }
    @Test void expiryReplayPolicyAndBearerRevocation() throws Exception {
        clearInvocations(sender);
        RegisteredViewer user = account("ACTIVE");
        String login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("identifier", user.getEmail(),"password","original-pass"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String oldBearer = json.readTree(login).get("token").asText();
        request(user.getEmail(), "192.0.2.31"); String resetToken = token();
        assertThat(resetToken).hasSizeGreaterThanOrEqualTo(43);
        confirm(resetToken,"short",400);
        confirm(resetToken,"x".repeat(73),400);
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+oldBearer)).andExpect(status().isOk());
        confirm(resetToken,"different-new-pass",200);
        confirm(resetToken,"different-new-pass",400);
        confirm("x".repeat(43),"different-new-pass",400);
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+oldBearer)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("identifier",user.getEmail(),"password","original-pass"))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("identifier",user.getEmail(),"password","different-new-pass"))))
                .andExpect(status().isOk());
        assertThat(viewers.findById(user.getId()).orElseThrow().getPasswordHash()).startsWith("$2");
    }
    @Test void expiredDigestCannotBeUsedAndDatabaseDoesNotStoreRawToken() throws Exception {
        clearInvocations(sender);
        RegisteredViewer user=account("ACTIVE");
        request(user.getEmail(),"192.0.2.41");
        String raw=token();
        String digest=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertThat(jdbc.queryForObject("select count(*) from password_reset_tokens where token_digest=?",Integer.class,digest)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from password_reset_tokens where token_digest=?",Integer.class,raw)).isZero();
        jdbc.update("update password_reset_tokens set expires_at=? where token_digest=?",
                java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(1)),digest);
        confirm(raw,"different-new-pass",400);
        assertThat(passwords.matches("original-pass",viewers.findById(user.getId()).orElseThrow().getPasswordHash())).isTrue();
    }
    @Test void simultaneousConfirmationConsumesTokenOnce() throws Exception {
        clearInvocations(sender);
        RegisteredViewer user=account("ACTIVE");
        request(user.getEmail(),"192.0.2.51");
        String raw=token();
        var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
        var gate=new java.util.concurrent.CountDownLatch(1);
        try {
            java.util.concurrent.Callable<Boolean> attempt=() -> { gate.await(); return resets.confirm(raw,"different-new-pass"); };
            var first=pool.submit(attempt); var second=pool.submit(attempt);
            gate.countDown();
            assertThat((first.get(20,java.util.concurrent.TimeUnit.SECONDS) ? 1 : 0)
                    +(second.get(20,java.util.concurrent.TimeUnit.SECONDS) ? 1 : 0)).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    @Test void sourceIpLimitIncludesUnknownAddresses() throws Exception {
        clearInvocations(sender);
        String ip="192.0.2.61";
        for(int i=0;i<10;i++) request("notfound"+UUID.randomUUID()+"@example.test",ip);
        request(account("ACTIVE").getEmail(),ip);
        verify(sender,never()).send(any(MimeMessage.class));
    }
    @Test void trustedProxyUsesRealIpAndIgnoresUntrustedHeaders() throws Exception {
        clearInvocations(sender);
        for(int i=0;i<10;i++) mvc.perform(post("/api/auth/password-reset/request")
                .with(r -> { r.setRemoteAddr("127.0.0.1"); return r; })
                .header("X-Real-IP","198.51.100.71").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("email","unknown"+UUID.randomUUID()+"@example.test")))).andExpect(status().isOk());
        mvc.perform(post("/api/auth/password-reset/request").with(r -> { r.setRemoteAddr("127.0.0.1"); return r; })
                .header("X-Real-IP","198.51.100.71").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("email",account("ACTIVE").getEmail())))).andExpect(status().isOk());
        verify(sender,never()).send(any(MimeMessage.class));
        RegisteredViewer user=account("ACTIVE");
        mvc.perform(post("/api/auth/password-reset/request").with(r -> { r.setRemoteAddr("198.51.100.72"); return r; })
                .header("X-Real-IP","198.51.100.71").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(java.util.Map.of("email",user.getEmail())))).andExpect(status().isOk());
        verify(sender,timeout(5000)).send(any(MimeMessage.class));
    }
    @Test void accountCooldownSurvivesMemoryResetAndDistinctIpFlood() throws Exception {
        clearInvocations(sender);
        RegisteredViewer user=account("ACTIVE");
        request(user.getEmail(),"203.0.113.1");
        verify(sender,timeout(5000)).send(any(MimeMessage.class));
        var field=PasswordResetService.class.getDeclaredField("limits"); field.setAccessible(true);
        ((java.util.Map<?,?>)field.get(org.springframework.test.util.AopTestUtils.getTargetObject(resets))).clear();
        request(user.getEmail(),"203.0.113.2");
        Thread.sleep(200);
        verify(sender,times(1)).send(any(MimeMessage.class));
        assertThat(jdbc.queryForObject("select reset_requested_at from users where user_id=?",java.sql.Timestamp.class,user.getId())).isNotNull();
    }
    @Test void limitEvictsOnlyOldestWhenOverCapacity() throws Exception {
        var method=PasswordResetService.class.getDeclaredMethod("allowed",String.class,int.class,long.class);
        method.setAccessible(true);
        String key="ip:flood-"+UUID.randomUUID();
        Object target=org.springframework.test.util.AopTestUtils.getTargetObject(resets);
        assertThat(method.invoke(target,key,1,0L)).isEqualTo(true);
        for(int i=0;i<10001;i++) method.invoke(target,"ip:"+i+":"+key,1,0L);
        var field=PasswordResetService.class.getDeclaredField("limits"); field.setAccessible(true);
        assertThat(((java.util.Map<?,?>)field.get(target)).size()).isLessThanOrEqualTo(10000);
        // A bulk clear would lose this recently inserted key even though only the oldest should go.
        String recent="ip:9000:"+key;
        assertThat(method.invoke(target,recent,1,0L)).isEqualTo(false);
    }
}
