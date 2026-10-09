package org.gp14.skopia.mail;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name="billing_mail_outbox", uniqueConstraints=@UniqueConstraint(name="uq_billing_mail_event_recipient", columnNames={"event_key","recipient"}), indexes=@Index(name="idx_billing_mail_due", columnList="status,next_attempt_at"))
public class BillingMailOutbox {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="event_key", nullable=false, length=100) private String eventKey;
    @Column(nullable=false, length=254) private String recipient;
    @Column(nullable=false, length=200) private String subject;
    @Column(nullable=false, columnDefinition="TEXT") private String body;
    @Column(nullable=false, length=20) private String status="PENDING";
    @Column(nullable=false) private int attempts;
    @Column(name="next_attempt_at", nullable=false) private LocalDateTime nextAttemptAt=LocalDateTime.now();
    @Column(name="claim_token", length=36) private String claimToken;
    @Column(name="last_error", length=80) private String lastError;
    @Column(name="sent_at") private LocalDateTime sentAt;
    public Long getId(){return id;}
    public String getEventKey(){return eventKey;}
    public void setEventKey(String v){eventKey=v;}
    public String getRecipient(){return recipient;}
    public void setRecipient(String v){recipient=v;}
    public String getSubject(){return subject;}
    public void setSubject(String v){subject=v;}
    public String getBody(){return body;}
    public void setBody(String v){body=v;}
    public String getStatus(){return status;}
    public void setStatus(String v){status=v;}
    public int getAttempts(){return attempts;}
    public void setAttempts(int v){attempts=v;}
    public LocalDateTime getNextAttemptAt(){return nextAttemptAt;}
    public void setNextAttemptAt(LocalDateTime v){nextAttemptAt=v;}
    public String getClaimToken(){return claimToken;}
    public void setClaimToken(String v){claimToken=v;}
    public String getLastError(){return lastError;}
    public void setLastError(String v){lastError=v;}
    public LocalDateTime getSentAt(){return sentAt;}
    public void setSentAt(LocalDateTime v){sentAt=v;}
}
