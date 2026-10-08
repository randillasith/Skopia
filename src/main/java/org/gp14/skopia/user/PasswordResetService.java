package org.gp14.skopia.user;

import org.gp14.skopia.mail.BillingMailAddress;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.repository.UserRepository;
import org.gp14.skopia.security.PasswordService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.gp14.skopia.mail.SkopiaEmailTemplates;
import org.gp14.skopia.mail.SkopiaMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.annotation.PreDestroy;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Service
public class PasswordResetService {
    private static final Logger LOG=LoggerFactory.getLogger(PasswordResetService.class);
    private static final String GENERIC="If the address is registered and delivery succeeds, a link will arrive.";
    private final UserRepository users;
    private final PasswordResetTokenRepository resets;
    private final PasswordService passwords;
    private final JavaMailSender sender;
    private final boolean resetConfigured;
    private final String from, origin;
    private final SkopiaEmailTemplates templates;
    private final TransactionTemplate transactions;
    private final SecureRandom random=new SecureRandom();
    // Account lookup, DB writes, and variable SMTP latency stay off the HTTP response path.
    private final ThreadPoolExecutor delivery=new ThreadPoolExecutor(2,2,0,TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(128), task -> {
                Thread thread=new Thread(task,"password-reset-delivery"); thread.setDaemon(true); return thread;
            });
    // Bounded per-instance abuse guard; keys are digests, never raw addresses or IPs.
    private final Map<String,Window> limits=new LinkedHashMap<>(1024,0.75f,true);
    private record Window(long start, int count, long last) {}

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository resets, PasswordService passwords,
            @Qualifier("billingMailSender") ObjectProvider<JavaMailSender> sender,
            @Value("${skopia.mail.enabled:false}") boolean mailEnabled,
            @Value("${skopia.mail.from:}") String from,
            @Value("${skopia.password-reset.public-origin:}") String origin,
            org.springframework.transaction.PlatformTransactionManager transactionManager, SkopiaEmailTemplates templates) {
        this.users=users; this.resets=resets; this.passwords=passwords; this.sender=sender.getIfAvailable();
        this.from=from; this.origin=origin; this.templates=templates;
        this.transactions=new TransactionTemplate(transactionManager);
        this.resetConfigured=mailEnabled && origin.matches("https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?")
                && BillingMailAddress.valid(from) && this.sender!=null;
    }
    public String request(String input, String ip) {
        if(input==null || input.length()>100 || !BillingMailAddress.valid(input.trim())) return GENERIC;
        String email=input.trim().toLowerCase(Locale.ROOT);
        String addressKey="email:"+digest(email), ipKey="ip:"+digest(ip==null?"unknown":ip);
        boolean addressAllowed=allowed(addressKey,3,900000);
        boolean ipAllowed=allowed(ipKey,10,0);
        if(!addressAllowed || !ipAllowed || !resetConfigured) return GENERIC;
        try { delivery.execute(() -> {
            try { deliver(email); }
            catch(RuntimeException ignored) { LOG.warn("Password reset delivery unavailable"); }
        }); }
        catch(RejectedExecutionException ignored) { LOG.warn("Password reset delivery queue full"); }
        return GENERIC;
    }
    public boolean isConfigured() { return resetConfigured; }
    private void deliver(String email) {
        byte[] bytes=new byte[32]; random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash=digest(token);
        // Serialize claims on the user row: this cooldown survives restarts and is shared across replicas.
        User user=transactions.execute(status -> {
            User locked=users.findByEmailForPasswordReset(email).orElse(null);
            if(locked==null || !"ACTIVE".equalsIgnoreCase(locked.getAccountStatus())) return null;
            Instant now=Instant.now();
            if(locked.getResetRequestedAt()!=null && locked.getResetRequestedAt().isAfter(now.minusSeconds(900))) return null;
            locked.setResetRequestedAt(now);
            users.saveAndFlush(locked);
            resets.saveAndFlush(new PasswordResetToken(hash,locked.getId(),now));
            return locked;
        });
        if(user==null) return;
        try {
            String resetUrl=origin+"/reset/confirm#token="+token;
            String plain="Open this link to reset your Skopia password (expires in one hour):\n"
                    +resetUrl+"\nIf you did not request this, ignore this email.\n";
            SkopiaMailMessage.send(sender,from,user.getEmail(),"Skopia password reset",plain,templates.passwordReset(resetUrl));
        } catch(RuntimeException ex) {
            // Transport exception messages can contain credentials and the link. Never log them.
            transactions.executeWithoutResult(status -> resets.invalidate(hash));
            LOG.error("PASSWORD_RESET_DELIVERY_FAILED: SMTP rejected reset message; token invalidated (no recipient or secret logged)");
        }
    }
    @PreDestroy
    void stop() {
        delivery.shutdown();
        try {
            if(!delivery.awaitTermination(20,TimeUnit.SECONDS)) delivery.shutdownNow();
        } catch(InterruptedException ex) {
            delivery.shutdownNow(); Thread.currentThread().interrupt();
        }
    }
    private synchronized boolean allowed(String key,int max,long cooldownMillis) {
        long now=System.currentTimeMillis();
        Window previous=limits.get(key);
        int count=previous==null || now-previous.start()>3600000 ? 1 : previous.count()+1;
        limits.put(key,new Window(previous==null || now-previous.start()>3600000 ? now : previous.start(),count,now));
        if(limits.size()>10000) limits.remove(limits.keySet().iterator().next());
        return count<=max && (previous==null || now-previous.start()>3600000 || now-previous.last()>=cooldownMillis);
    }
    @Transactional
    public boolean confirm(String token,String newPassword) {
        if(token==null || !token.matches("[A-Za-z0-9_-]{43}") || newPassword==null
                || newPassword.length()<8 || newPassword.length()>72
                || newPassword.getBytes(StandardCharsets.UTF_8).length>72) return false;
        String hash=digest(token);
        PasswordResetToken reset=resets.findById(hash).orElse(null);
        if(reset==null || reset.isConsumed() || !reset.getExpiresAt().isAfter(Instant.now())) return false;
        // A row-level conditional update ensures at most one transaction can consume this digest.
        if(resets.consume(hash,Instant.now())!=1) return false;
        User user=users.findByIdForPasswordReset(reset.getUserId()).orElse(null);
        if(user==null || !"ACTIVE".equalsIgnoreCase(user.getAccountStatus())) return false;
        user.setPasswordHash(passwords.encode(newPassword));
        user.setAuthVersion((user.getAuthVersion()==null ? 0L : user.getAuthVersion())+1);
        users.saveAndFlush(user);
        resets.revokeForUser(user.getId());
        return true;
    }
    private static String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch(java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
}
