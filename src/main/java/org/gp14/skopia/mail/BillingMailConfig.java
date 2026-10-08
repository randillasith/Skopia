package org.gp14.skopia.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import java.util.Properties;

@Configuration
@ConditionalOnProperty(name="skopia.mail.enabled", havingValue="true")
public class BillingMailConfig {
    @Bean("billingMailSender")
    JavaMailSender billingMailSender(@Value("${skopia.mail.host:}") String host,
              @Value("${skopia.mail.port:587}") int port,
              @Value("${skopia.mail.username:}") String username,
              @Value("${skopia.mail.password:}") String password) {
        if(host.isBlank() || username.isBlank() || password.isBlank() || port < 1 || port > 65535)
            throw new IllegalStateException("Enabled billing mail requires host, port and authenticated credentials");
        JavaMailSenderImpl sender=new JavaMailSenderImpl();
        sender.setHost(host); sender.setPort(port); sender.setUsername(username); sender.setPassword(password);
        Properties properties=sender.getJavaMailProperties();
        properties.put("mail.smtp.auth","true");
        properties.put("mail.smtp.starttls.enable","true");
        properties.put("mail.smtp.starttls.required","true");
        properties.put("mail.smtp.ssl.checkserveridentity","true");
        properties.put("mail.smtp.connectiontimeout","5000");
        properties.put("mail.smtp.timeout","5000");
        properties.put("mail.smtp.writetimeout","5000");
        return sender;
    }
}
