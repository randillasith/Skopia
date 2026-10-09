package org.gp14.skopia.user;

import jakarta.annotation.PreDestroy;
import org.gp14.skopia.mail.BillingMailAddress;
import org.gp14.skopia.mail.SkopiaEmailTemplates;
import org.gp14.skopia.mail.SkopiaMailMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Best-effort post-registration delivery. Mail failure must never roll back a created account. */
@Service
public class WelcomeMailService {
    private static final Logger LOG=LoggerFactory.getLogger(WelcomeMailService.class);
    private final JavaMailSender sender;
    private final SkopiaEmailTemplates templates;
    private final String from;
    private final boolean configured;
    private final ThreadPoolExecutor delivery=new ThreadPoolExecutor(1,1,0,TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(128),task->{
                Thread thread=new Thread(task,"welcome-mail-delivery"); thread.setDaemon(true); return thread;
            });

    public WelcomeMailService(@Qualifier("billingMailSender") ObjectProvider<JavaMailSender> sender,
                              SkopiaEmailTemplates templates,
                              @Value("${skopia.mail.enabled:false}") boolean mailEnabled,
                              @Value("${skopia.mail.from:}") String from) {
        this.sender=sender.getIfAvailable(); this.templates=templates; this.from=from;
        this.configured=mailEnabled && this.sender!=null && BillingMailAddress.valid(from);
    }

    public void queue(String email) {
        if(!configured || !BillingMailAddress.valid(email)) return;
        String recipient=email.trim();
        try {
            delivery.execute(()->deliver(recipient));
        } catch(RejectedExecutionException ignored) {
            LOG.warn("Welcome email delivery queue full");
        }
    }

    private void deliver(String recipient) {
        try {
            String plain="Welcome to Skopia. Your account is ready.\n"
                    +"Start watching: "+templates.publicOrigin()+"/\n"
                    +"Sign in: "+templates.publicOrigin()+"/login\n"
                    +"Account email: "+recipient+"\n";
            SkopiaMailMessage.send(sender,from,recipient,"Welcome to Skopia",plain,templates.welcome(recipient));
        } catch(RuntimeException ignored) {
            // Never log addresses or transport details, which can expose recipient data or credentials.
            LOG.warn("Welcome email delivery unavailable");
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
}
