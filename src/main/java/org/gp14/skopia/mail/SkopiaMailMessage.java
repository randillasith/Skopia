package org.gp14.skopia.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;

/** UTF-8 multipart/alternative: readable plain text first, supplied branded HTML second. */
public final class SkopiaMailMessage {
    private SkopiaMailMessage() {}
    public static void send(JavaMailSender sender,String from,String to,String subject,String plain,String html) {
        try {
            MimeMessage message=new MimeMessage((Session)null);
            MimeMessageHelper helper=new MimeMessageHelper(message,true,"UTF-8");
            helper.setFrom(from); helper.setTo(to); helper.setSubject(subject);
            helper.setText(plain,html);
            message.saveChanges();
            sender.send(message);
        } catch(MessagingException ex) { throw new MailPreparationException("Email MIME preparation failed"); }
    }
}
