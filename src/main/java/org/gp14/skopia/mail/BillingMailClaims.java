package org.gp14.skopia.mail;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.model.user.Administrator;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class BillingMailClaims {
    private final BillingMailOutboxRepository outbox;
    private final UserRepository users;
    private final String mainUsername;
    public BillingMailClaims(BillingMailOutboxRepository outbox, UserRepository users,
                             @Value("${skopia.mail.main-admin-username:main}") String mainUsername) {
        this.outbox=outbox; this.users=users; this.mainUsername=mainUsername;
    }
    public record Claimed(Long id, String token, String recipient, String subject, String body, String eventKey) {}
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public Claimed claim(Long id) {
        var row=outbox.locked(id).orElse(null);
        if(row==null || row.getNextAttemptAt().isAfter(LocalDateTime.now())
                || !("PENDING".equals(row.getStatus()) || "SENDING".equals(row.getStatus()))) return null;
        String recipient=row.getRecipient();
        if(BillingMailService.MAIN_ADMIN_RECIPIENT.equals(recipient)) {
            recipient=users.findByUsername(mainUsername)
                    .filter(u->u instanceof Administrator && "ACTIVE".equals(u.getAccountStatus()))
                    .map(u->u.getEmail()).filter(BillingMailAddress::valid)
                    .orElse(null);
            if(recipient==null) {
                // Remain visible and retryable. Do not burn an SMTP attempt without an active admin.
                row.setStatus("PENDING");
                row.setClaimToken(null);
                row.setNextAttemptAt(LocalDateTime.now().plusMinutes(1));
                row.setLastError("Main administrator unavailable");
                return null;
            }
        }
        if(row.getAttempts()>=4) {
            row.setStatus("FAILED"); row.setClaimToken(null); row.setLastError("SMTP delivery outcome unknown after lease expiry");
            return null;
        }
        row.setStatus("SENDING"); row.setAttempts(row.getAttempts()+1);
        row.setNextAttemptAt(LocalDateTime.now().plusMinutes(5)); // crash recovery lease
        row.setClaimToken(UUID.randomUUID().toString());
        outbox.saveAndFlush(row);
        row.setLastError(null);
        return new Claimed(row.getId(),row.getClaimToken(),recipient,row.getSubject(),row.getBody(),row.getEventKey());
    }
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void complete(Claimed claim, boolean sent) {
        var row=outbox.locked(claim.id()).orElse(null);
        if(row==null || !"SENDING".equals(row.getStatus()) || !claim.token().equals(row.getClaimToken())) return;
        row.setClaimToken(null);
        if(sent) {row.setStatus("SENT"); row.setSentAt(LocalDateTime.now()); row.setLastError(null);}
        else {
            row.setStatus(row.getAttempts()>=4?"FAILED":"PENDING");
            row.setNextAttemptAt(LocalDateTime.now().plusMinutes(1L << row.getAttempts()));
            row.setLastError("SMTP delivery failed"); // never persist exception text or credentials
        }
    }
}
