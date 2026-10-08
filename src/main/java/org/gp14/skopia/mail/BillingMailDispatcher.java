package org.gp14.skopia.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@ConditionalOnProperty(name="skopia.mail.enabled", havingValue="true")
public class BillingMailDispatcher {
    private static final Logger LOG=LoggerFactory.getLogger(BillingMailDispatcher.class);
    private final BillingMailOutboxRepository outbox;
    private final BillingMailClaims claims;
    private final JavaMailSender sender;
    private final String from;
    public BillingMailDispatcher(BillingMailOutboxRepository outbox, BillingMailClaims claims,
                                 @Qualifier("billingMailSender") JavaMailSender sender,
                                 @Value("${skopia.mail.from:}") String from) {
        if(!BillingMailAddress.valid(from))
            throw new IllegalStateException("Enabled billing mail requires a valid from address");
        this.outbox=outbox; this.claims=claims; this.sender=sender; this.from=from;
    }
    @Scheduled(cron="${skopia.mail.cron:*/30 * * * * *}")
    public void dispatch() {
        for(Long id:outbox.due(LocalDateTime.now(),PageRequest.of(0,25))) {
            try {
                BillingMailClaims.Claimed claim=claims.claim(id);
                if(claim==null) continue;
                boolean sent=false;
                try {
                    SimpleMailMessage message=new SimpleMailMessage();
                    message.setFrom(from); message.setTo(claim.recipient()); message.setSubject(claim.subject());
                    message.setText(claim.body());
                    sender.send(message);
                    sent=true;
                } catch (Exception ignored) {
                    // Never log exception text: transport errors may contain credentials or addresses.
                } finally {
                    claims.complete(claim,sent);
                }
            } catch (RuntimeException ignored) {
                // A database problem on one row must not prevent the rest of this batch.
                LOG.warn("Billing mail dispatch failed for outbox id {}", id);
            }
        }
    }
}
