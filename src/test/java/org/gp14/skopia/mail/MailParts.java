package org.gp14.skopia.mail;

import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;

/** Inspect the actual MIME payload without flattening alternatives or exposing tokens in logs. */
public final class MailParts {
    private MailParts() {}
    public static String[] recipients(MimeMessage message) {
        try { return java.util.Arrays.stream(message.getAllRecipients()).map(Object::toString).toArray(String[]::new); }
        catch(Exception ex) {throw new IllegalStateException("Invalid MIME recipients",ex);}
    }
    public static String plain(MimeMessage message) { return text(message,"text/plain"); }
    public static String html(MimeMessage message) { return text(message,"text/html"); }
    private static String text(Part part,String type) {
        try {
            if(part.isMimeType(type)) return (String)part.getContent();
            if(part.isMimeType("multipart/*")) {
                Multipart content=(Multipart)part.getContent();
                for(int i=0;i<content.getCount();i++) {String value=text(content.getBodyPart(i),type); if(!value.isEmpty()) return value;}
            }
            return "";
        } catch(Exception ex) {throw new IllegalStateException("Invalid MIME test message",ex);}
    }
}
