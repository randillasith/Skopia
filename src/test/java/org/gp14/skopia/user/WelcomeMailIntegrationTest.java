package org.gp14.skopia.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.internet.MimeMessage;
import org.gp14.skopia.mail.MailParts;
import org.gp14.skopia.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties={"skopia.mail.enabled=true", "skopia.mail.cron=-", "skopia.mail.host=mail.example.test",
        "skopia.mail.username=test-user", "skopia.mail.password=test-only", "skopia.mail.from=notifications@example.test",
        "skopia.mail.public-origin=https://app.example.test", "skopia.password-reset.public-origin=https://app.example.test"})
class WelcomeMailIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired org.gp14.skopia.repository.ActivityLogRepository activityLogs;
    @MockitoBean(name="billingMailSender") JavaMailSender sender;
    private String prefix;

    @AfterEach void clean() {
        if(prefix!=null) users.findAll().stream().filter(u->u.getUsername().startsWith(prefix)).forEach(user->{
            activityLogs.deleteAll(activityLogs.findByTargetUserIdOrActorIdOrUserIdOrderByActionTimeDesc(user.getId(),user.getId(),user.getId()));
            users.delete(user);
        });
    }

    @Test void successfulViewerAndCreatorRegistrationQueueOneBrandedMultipartWelcomeEach() throws Exception {
        prefix="welcome_"+UUID.randomUUID().toString().replace("-","").substring(0,10);
        register(prefix+"v",prefix+"v@example.test",null).andExpect(status().isCreated());
        register(prefix+"c",prefix+"c@example.test","CONTENT_CREATOR").andExpect(status().isCreated());

        var captured=org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(sender,timeout(5000).atLeast(2)).send(captured.capture());
        var current=captured.getAllValues().stream().filter(m->MailParts.plain(m).contains(prefix)).toList();
        assertThat(current).hasSize(2).allSatisfy(message->{
            String plain=MailParts.plain(message),html=MailParts.html(message);
            assertThat(message.getSubject()).isEqualTo("Welcome to Skopia");
            assertThat(plain).contains("Your account is ready", "https://app.example.test/", "https://app.example.test/login");
            assertThat(html).contains("Welcome to Skopia", "Start watching", "Free browsing", "Premium programme",
                    "No interruptions", "https://app.example.test/skopia-logo.png");
            assertThat(html).doesNotContain("{{", "password");
            assertThat(MailParts.recipients(message)).singleElement().asString().contains(prefix);
        });
    }

    @Test void duplicateRegistrationDoesNotSendAnotherWelcome() throws Exception {
        prefix="welcome_dup_"+UUID.randomUUID().toString().replace("-","").substring(0,8);
        String email=prefix+"@example.test";
        register(prefix,email,null).andExpect(status().isCreated());
        register(prefix,email,null).andExpect(status().isConflict());
        verify(sender,timeout(5000).times(1)).send(argThat((MimeMessage message)->MailParts.plain(message).contains(email)));
    }

    @Test void smtpFailureNeverRollsBackCreatedAccountOrExposeTransportFailure() throws Exception {
        prefix="welcome_fail_"+UUID.randomUUID().toString().replace("-","").substring(0,8);
        String email=prefix+"@example.test";
        doAnswer(invocation->{
            MimeMessage message=invocation.getArgument(0);
            if(MailParts.plain(message).contains(email)) throw new MailSendException("mock secret transport detail");
            return null;
        }).when(sender).send(any(MimeMessage.class));
        String response=register(prefix,email,null).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat(response).contains("Account created").doesNotContain("mock secret", "transport");
        verify(sender,timeout(5000)).send(argThat((MimeMessage message)->MailParts.plain(message).contains(email)));
        assertThat(users.findByEmail(email)).isPresent();
    }

    private org.springframework.test.web.servlet.ResultActions register(String username,String email,String role) throws Exception {
        var body=new java.util.LinkedHashMap<String,Object>();
        body.put("username",username); body.put("email",email); body.put("password","welcome-password");
        body.put("firstName","Welcome"); body.put("lastName","Viewer");
        if(role!=null) {body.put("roleType",role); body.put("channelName",username+" Studio");}
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
}
