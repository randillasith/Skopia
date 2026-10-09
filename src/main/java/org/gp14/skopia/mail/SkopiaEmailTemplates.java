package org.gp14.skopia.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/** Branded presentation of existing immutable plain-text outbox snapshots. No token is persisted. */
@Component
public class SkopiaEmailTemplates {
    private static final Pattern PLACEHOLDER=Pattern.compile("\\{\\{([A-Z_]+)}}");
    private final String origin;
    public SkopiaEmailTemplates(@Value("${skopia.mail.public-origin:https://skopia.randillasith.me}") String origin) {
        if (!origin.matches("https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?"))
            throw new IllegalArgumentException("Email public origin must be a canonical HTTPS origin without a path");
        this.origin=origin;
    }

    /** Known billing snapshots only; old/custom outbox messages keep the plain-text fallback. */
    public Optional<String> billing(String eventKey, String body) {
        if (eventKey==null || body==null) return Optional.empty();
        Map<String,String> fields=new HashMap<>();
        for (String line:body.split("\\R")) {
            int colon=line.indexOf(": ");
            if (colon>0) fields.putIfAbsent(line.substring(0,colon),line.substring(colon+2));
        }
        Map<String,String> values=branding(origin);
        if (eventKey.startsWith("DEMO_PAYMENT_RECEIPT:") && body.startsWith("Skopia simulated subscription payment receipt")) {
            if (!fields.keySet().containsAll(java.util.Set.of("Order reference","Payment ID","Plan","Simulated payment","Starts","Ends"))) return Optional.empty();
            values.put("ORDER_REF",fields.get("Order reference")); values.put("PAYMENT_ID",fields.get("Payment ID"));
            values.put("PLAN",fields.get("Plan")); values.put("AMOUNT",fields.get("Simulated payment"));
            values.put("ACCESS_LABEL","30-day access · no automatic renewal");
            values.put("ACCESS_STARTS",accessDate(fields.get("Starts"))); values.put("ACCESS_ENDS",accessDate(fields.get("Ends")));
            values.put("BILLING_URL",origin+"/billing");
            return Optional.of(render("payment-receipt.html",values));
        }
        if (eventKey.startsWith("REFUND_") && body.startsWith("Skopia simulated refund status")) {
            String status=fields.get("Status");
            if (status==null || !java.util.Set.of("PENDING","APPROVED","REJECTED","CANCELLED").contains(status)
                    || !eventKey.startsWith("REFUND_"+status+":")
                    || !fields.keySet().containsAll(java.util.Set.of("Refund ID","Category","Amount"))) return Optional.empty();
            values.put("STATUS",status); values.put("AMOUNT",fields.get("Amount"));
            values.put("CATEGORY",fields.get("Category").replace('_',' '));
            values.put("REFUND_ID",fields.get("Refund ID")); values.put("PAYMENT_ID",fields.getOrDefault("Payment ID","See billing history"));
            values.put("STATUS_COLOR",switch(status) {case "APPROVED" -> "#16c784"; case "REJECTED" -> "#f63d68"; case "CANCELLED" -> "#b6c1d6"; default -> "#ffce6a";});
            values.put("STATUS_NOTE",switch(status) {
                case "APPROVED" -> "Administrator approval recorded. The related subscription pass has ended; the simulated payment remains in your billing history. No real money was moved or returned.";
                case "REJECTED" -> "The administrator rejected this request. No refund or access reversal was made. Log in to view the decision details. No real money was moved.";
                case "CANCELLED" -> "Your pending request was cancelled. No refund or access reversal was made. No real money was moved.";
                default -> "Your request is pending administrator review. An approved refund ends the related pass; until then this request does not change access. No real money was moved.";
            });
            values.put("REFUNDS_URL",origin+"/billing");
            return Optional.of(render("refund-status.html",values));
        }
        return Optional.empty();
    }

    public String publicOrigin() { return origin; }

    public String welcome(String email) {
        if (!BillingMailAddress.valid(email)) throw new IllegalArgumentException("Invalid welcome recipient");
        Map<String,String> values=branding(origin);
        values.put("USER_EMAIL",email.trim()); values.put("APP_URL",origin+"/"); values.put("LOGIN_URL",origin+"/login");
        return render("welcome.html",values);
    }

    /** Generated reset URL is used only in memory; retain its fragment and canonical origin. */
    public String passwordReset(String resetUrl) {
        URI url=URI.create(resetUrl);
        String resetOrigin=url.getScheme()+"://"+url.getRawAuthority();
        if (!resetOrigin.matches("https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?")
                || !"/reset/confirm".equals(url.getRawPath()) || url.getRawQuery()!=null
                || url.getRawFragment()==null || !url.getRawFragment().matches("token=[A-Za-z0-9_-]{43}"))
            throw new IllegalArgumentException("Invalid generated reset URL");
        Map<String,String> values=branding(resetOrigin); values.put("RESET_URL",resetUrl);
        return render("password-reset.html",values);
    }
    private String accessDate(String value) {
        try { return java.time.LocalDateTime.parse(value).format(java.time.format.DateTimeFormatter.ofPattern("MMM d, uuuu 'at' HH:mm",java.util.Locale.ENGLISH)); }
        catch(java.time.format.DateTimeParseException ex) { return value; }
    }
    private Map<String,String> branding(String base) {
        var values=new HashMap<String,String>();
        values.put("LOGO_URL",base+"/skopia-logo.png"); values.put("HOME_URL",base+"/");
        values.put("SITE_HOST",URI.create(base).getAuthority()); return values;
    }
    private String render(String name,Map<String,String> values) {
        try (var stream=new ClassPathResource("mail/"+name).getInputStream()) {
            String source=StreamUtils.copyToString(stream,StandardCharsets.UTF_8);
            var matcher=PLACEHOLDER.matcher(source);
            return matcher.replaceAll(match -> {
                String value=values.get(match.group(1));
                if(value==null) throw new IllegalArgumentException("Missing email template value: "+match.group(1));
                return java.util.regex.Matcher.quoteReplacement(HtmlUtils.htmlEscape(value,StandardCharsets.UTF_8.name()));
            });
        } catch(IOException ex) { throw new IllegalStateException("Email template unavailable",ex); }
    }
}
