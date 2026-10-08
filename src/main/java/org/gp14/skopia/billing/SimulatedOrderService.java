package org.gp14.skopia.billing;

import jakarta.persistence.EntityManager;
import org.gp14.skopia.model.subscription.*;
import org.gp14.skopia.model.user.*;
import org.gp14.skopia.mail.BillingMailService;
import org.gp14.skopia.mail.BillingMailAddress;
import org.gp14.skopia.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/** Test-only order flow. No bank verification, payment gateway, or money movement exists. */
@Service
public class SimulatedOrderService {
    private static final BigDecimal PRICE = new BigDecimal("500.00");
    private static final Pattern CARD_CANDIDATE = Pattern.compile("(?<![0-9])(?:[0-9][ .-]?){12,18}[0-9](?![0-9])");
    private final BillingOrderRepository orders;
    private final UserRepository users;
    private final SubscriptionPlanRepository plans;
    private final SubscriptionRepository subscriptions;
    private final PaymentRepository payments;
    private final EntityManager em;
    private final BillingMailService billingMail;
    private final boolean enabled;
    // Off by default even when complimentary billing is enabled. The opt-in supports
    // isolated compatibility tests; do not enable it for ordinary checkout.
    private final boolean legacyOrdersEnabled;
    private final Path storage;

    public SimulatedOrderService(BillingOrderRepository orders, UserRepository users, SubscriptionPlanRepository plans,
            SubscriptionRepository subscriptions, PaymentRepository payments, EntityManager em, BillingMailService billingMail,
            @Value("${skopia.billing.demo-enabled:false}") boolean enabled,
            @Value("${skopia.billing.legacy-orders-enabled:false}") boolean legacyOrdersEnabled,
            @Value("${skopia.billing.private-storage-dir:${user.home}/.skopia/private-billing-slips}") String storage) {
        this.orders=orders; this.users=users; this.plans=plans; this.subscriptions=subscriptions;
        this.payments=payments; this.em=em; this.billingMail=billingMail; this.enabled=enabled;
        this.legacyOrdersEnabled=legacyOrdersEnabled;
        this.storage=Path.of(storage).toAbsolutePath().normalize();
        if (this.storage.startsWith(Path.of("uploads").toAbsolutePath().normalize()) ||
                this.storage.startsWith(Path.of("src/main/resources/static").toAbsolutePath().normalize()))
            throw new IllegalArgumentException("Billing slips must be outside public web roots");
    }

    @Transactional
    public BillingDtos.OrderView card(Long id, String plan, String brand, BillingDtos.BillingContact contact) {
        checkLegacyOrdersEnabled(); checkEnabled(); checkPlan(plan);
        if (!List.of("VISA","MASTERCARD","AMEX").contains(brand)) bad("Unsupported preview brand");
        Viewer owner=lockViewer(id);
        BillingOrder o=create(owner,plan,"CARD_PREVIEW",brand,contact);
        o.setStatus("SIMULATED_APPROVED");
        activate(o,owner,"CARD_PREVIEW_"+brand);
        return view(orders.saveAndFlush(o));
    }

    /** No-charge test-card UX: only a derived network brand reaches the server. No payment is recorded. */
    @Transactional
    public BillingDtos.OrderView noChargeCard(Long id, String plan, String brand, BillingDtos.BillingContact contact) {
        checkLegacyOrdersEnabled(); checkEnabled(); checkPlan(plan);
        if (!List.of("VISA", "MASTERCARD").contains(brand)) bad("Unsupported test-card brand");
        Viewer owner=lockViewer(id);
        BillingOrder order=create(owner,plan,"NO_CHARGE_TEST_CARD",brand,contact);
        order.setReference("NC-"+UUID.randomUUID());
        order.setAmount(BigDecimal.ZERO);
        order.setStatus("NO_CHARGE_ACTIVE");
        Subscription subscription=issueEntitlement(owner);
        order.setSubscription(subscription);
        order=orders.saveAndFlush(order);
        billingMail.receipt(order);
        return view(order);
    }

    /** Complimentary access has no card, payment, or automatic renewal. */
    @Transactional
    public BillingDtos.OrderView complimentary(Long id, String plan, BillingDtos.BillingContact contact) {
        checkEnabled(); checkPlan(plan);
        Viewer owner=lockViewer(id);
        BillingOrder order=create(owner,plan,"COMPLIMENTARY",null,contact);
        order.setReference("COMP-"+UUID.randomUUID());
        order.setAmount(BigDecimal.ZERO);
        order.setStatus("NO_CHARGE_ACTIVE");
        order.setSubscription(issueEntitlement(owner));
        order=orders.saveAndFlush(order);
        billingMail.receipt(order);
        return view(order);
    }
    @Transactional
    public BillingDtos.OrderView bank(Long id, String plan, BillingDtos.BillingContact contact,
                                       String reference, MultipartFile slip) {
        checkLegacyOrdersEnabled(); checkEnabled(); checkPlan(plan);
        Viewer owner=lockViewer(id);
        byte[] bytes;
        try {
            if (slip==null || slip.isEmpty() || slip.getSize()>5_242_880) bad("Slip must be 1 byte to 5 MB");
            bytes=slip.getBytes();
        } catch(IOException ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unable to read slip",ex); }
        String type=type(bytes);
        if (type==null || !type.equals(slip.getContentType())) bad("Slip must be a PNG, JPEG, or PDF matching its content type");
        BillingOrder o=create(owner,plan,"BANK_TRANSFER",null,contact);
        if(reference!=null && !reference.isBlank()) o.setTransferReference(text(reference,100,"Reference"));
        o.setStatus("PENDING_REVIEW"); o.setSlipType(type);
        String key=UUID.randomUUID().toString(); o.setSlipKey(key);
        Path target=storage.resolve(key);
        try {
            Files.createDirectories(storage);
            Files.setPosixFilePermissions(storage,PosixFilePermissions.fromString("rwx------"));
            try(var out=Files.newOutputStream(target,StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE)) {
                out.write(bytes);
            }
            Files.setPosixFilePermissions(target,PosixFilePermissions.fromString("rw-------"));
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCompletion(int status) {
                    if(status!=STATUS_COMMITTED) try { Files.deleteIfExists(target); } catch(IOException ignored) { /* best effort cleanup */ }
                }
            });
        } catch(IOException ex) {
            try { Files.deleteIfExists(target); } catch(IOException ignored) { /* best effort */ }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,"Could not store private slip",ex);
        }
        return view(orders.saveAndFlush(o));
    }

    @Transactional(readOnly=true)
    public List<BillingDtos.OrderView> ownerOrders(Long id) {
        requireViewer(id);
        return orders.findByOwnerIdOrderBySubmittedAtDescIdDesc(id).stream().map(this::view).toList();
    }
    @Transactional(readOnly=true)
    public List<BillingDtos.OrderView> adminOrders(User actor) {
        requireAdmin(actor);
        return orders.findAllByOrderBySubmittedAtDescIdDesc().stream().map(this::view).toList();
    }
    @Transactional(readOnly=true)
    public byte[] slip(User actor,Long orderId) {
        requireAdmin(actor);
        BillingOrder order=orders.findById(orderId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        if(order.getSlipKey()==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        try {
            Path path=storage.resolve(order.getSlipKey());
            if(Files.isSymbolicLink(path)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
            return Files.readAllBytes(path);
        }
        catch(IOException ex) { throw new ResponseStatusException(HttpStatus.NOT_FOUND); }
    }
    @Transactional(readOnly=true)
    public String slipType(User actor,Long orderId) {
        requireAdmin(actor);
        return orders.findById(orderId).filter(o->o.getSlipKey()!=null).map(BillingOrder::getSlipType)
                .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    @Transactional
    public BillingDtos.OrderView decide(User actor,Long id,String decision,String note) {
        requireAdmin(actor); checkEnabled();
        if (!List.of("APPROVED","REJECTED").contains(decision)) bad("Invalid decision");
        String cleanNote=note==null || note.isBlank()?null:text(note,500,"Decision note");
        if("REJECTED".equals(decision) && cleanNote==null) bad("Rejection note required");
        BillingOrder order=orders.lockedById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        if(!"PENDING_REVIEW".equals(order.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Order has already been decided");
        order.setStatus(decision); order.setDecidedBy(actor); order.setDecidedAt(LocalDateTime.now());
        order.setDecisionNote(cleanNote);
        if("APPROVED".equals(decision)) {
            Viewer owner=lockViewer(order.getOwner().getId());
            activate(order,owner,"BANK_TRANSFER_PREVIEW");
        }
        return view(orders.saveAndFlush(order));
    }

    private BillingOrder create(Viewer owner,String plan,String method,String brand,BillingDtos.BillingContact c) {
        if(c==null || !"LK".equals(c.country())) bad("Sri Lankan billing contact required");
        BillingOrder o=new BillingOrder(); o.setOwner(owner); o.setReference("SIM-"+UUID.randomUUID());
        o.setPlanName(plan); o.setAmount(PRICE); o.setCurrency(Currency.LKR);
        o.setMethod(method); o.setBrand(brand); o.setSubmittedAt(LocalDateTime.now());
        o.setFullName(text(c.fullName(),120,"Full name"));
        o.setEmail(text(c.email(),254,"Email"));
        if(!BillingMailAddress.valid(o.getEmail())) bad("Invalid billing email");
        o.setPhone(text(c.phone(),30,"Phone"));
        if(!o.getPhone().matches("[+0-9() .-]{7,30}")) bad("Invalid phone");
        o.setAddressLine1(text(c.addressLine1(),200,"Address"));
        o.setAddressLine2(c.addressLine2()==null || c.addressLine2().isBlank()?null:text(c.addressLine2(),200,"Address line 2"));
        o.setCity(text(c.city(),100,"City")); o.setPostalCode(text(c.postalCode(),20,"Postal code"));
        o.setCountry("LK"); return o;
    }
    private Subscription issueEntitlement(Viewer owner) {
        var current=subscriptions.findByViewerIdAndSubStatusAndEndDateAfterOrderByEndDateDesc(owner.getId(),"ACTIVE",LocalDateTime.now());
        if(!current.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,"An active pass already exists");
        SubscriptionPlan plan=plans.findByPlanName("MONTHLY")
                .orElseThrow(()->new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Monthly plan unavailable"));
        LocalDateTime now=LocalDateTime.now();
        Subscription s=new Subscription(); s.setViewer(owner); s.setPlan(plan); s.setStartDate(now);
        s.setEndDate(now.plusDays(30)); s.setSubStatus("ACTIVE"); s.setAutoRenew(false);
        s=subscriptions.saveAndFlush(s);
        if(owner instanceof RegisteredViewer rv) rv.setIsPremium(true);
        return s;
    }
    private void activate(BillingOrder order,Viewer owner,String method) {
        Subscription s=issueEntitlement(owner);
        LocalDateTime now=LocalDateTime.now();
        Payment p=new Payment(); p.setSubscription(s); p.setAmount(PRICE); p.setCurrency(Currency.LKR);
        p.setPaidDatetime(now); p.setPayMethod(method); p.setPayStatus("SIMULATED");
        p.setGatewayRef(order.getReference()); p=payments.saveAndFlush(p);
        order.setSubscription(s); order.setPayment(p);
        if(owner instanceof RegisteredViewer rv) rv.setIsPremium(true);
    }
    private BillingDtos.OrderView view(BillingOrder o) {
        return new BillingDtos.OrderView(o.getId(),o.getOwner().getId(),o.getOwner().getUsername(),o.getReference(),o.getPlanName(),o.getAmount(),o.getCurrency(),
                o.getMethod(),o.getBrand(),o.getStatus(),!"COMPLIMENTARY".equals(o.getMethod()),o.getSubmittedAt(),
                new BillingDtos.BillingContact(o.getFullName(),o.getEmail(),o.getPhone(),o.getAddressLine1(),
                    o.getAddressLine2(),o.getCity(),o.getPostalCode(),o.getCountry()),
                o.getTransferReference(),o.getDecidedBy()==null?null:o.getDecidedBy().getId(),o.getDecidedAt(),
                o.getDecisionNote(),o.getSubscription()==null?null:o.getSubscription().getId(),
                o.getPayment()==null?null:o.getPayment().getId(),
                "COMPLIMENTARY".equals(o.getMethod())
                    ? "Complimentary 30-day access. Listed monthly price LKR 500; amount due LKR 0. No automatic renewal."
                    : "NO_CHARGE_TEST_CARD".equals(o.getMethod())
                    ? "No charge · test cards only · no payment. A 30-day nonrenewing access pass was issued."
                    : "TEST ONLY: preview amount; no actual payment, bank transfer verification, or money movement.");
    }
    private Viewer requireViewer(Long id) {
        User u=id==null?null:users.findById(id).orElse(null);
        if(!(u instanceof Viewer v) || !"ACTIVE".equals(u.getAccountStatus()))
            throw new ResponseStatusException(id==null?HttpStatus.UNAUTHORIZED:HttpStatus.FORBIDDEN);
        return v;
    }
    private Viewer lockViewer(Long id) { Viewer v=requireViewer(id); em.lock(v,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE); return v; }
    private void requireAdmin(User actor) {
        if(!(actor instanceof Administrator) || !"ACTIVE".equals(actor.getAccountStatus()))
            throw new ResponseStatusException(actor==null?HttpStatus.UNAUTHORIZED:HttpStatus.FORBIDDEN);
    }
    private void checkEnabled() { if(!enabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Preview billing disabled"); }
    public void checkLegacyOrdersEnabled() {
        if (!legacyOrdersEnabled) throw new ResponseStatusException(HttpStatus.GONE,"Legacy order creation retired");
    }
    private void checkPlan(String plan) { if(!"MONTHLY".equals(plan)) bad("Only MONTHLY is available"); }
    private String text(String value,int max,String field) {
        if(value==null || value.isBlank() || value.trim().length()>max || value.chars().anyMatch(c->c<32 || c==127)) bad("Invalid "+field);
        if (containsCardNumber(value)) bad("Card numbers are not allowed in billing contact details");
        return value.trim();
    }
    private boolean containsCardNumber(String value) {
        var matches=CARD_CANDIDATE.matcher(value);
        while (matches.find()) {
            String digits=matches.group().replaceAll("[ .-]", "");
            // Any 13–19 digit Luhn-valid sequence, regardless of network prefix.
            int sum=0;
            for (int i=digits.length()-1, position=0; i>=0; i--, position++) {
                int digit=digits.charAt(i)-'0';
                if (position%2==1) { digit*=2; if (digit>9) digit-=9; }
                sum+=digit;
            }
            if (sum%10==0) return true;
        }
        return false;
    }
    private void bad(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
    private String type(byte[] b) {
        if(b.length>=45 && Arrays.equals(Arrays.copyOf(b,8),new byte[]{(byte)137,80,78,71,13,10,26,10})
                && b[12]=='I' && b[13]=='H' && b[14]=='D' && b[15]=='R'
                && b[b.length-8]=='I' && b[b.length-7]=='E' && b[b.length-6]=='N' && b[b.length-5]=='D') return "image/png";
        if(b.length>=4 && (b[0]&255)==255 && (b[1]&255)==216 && (b[2]&255)==255 && (b[b.length-2]&255)==255 && (b[b.length-1]&255)==217) return "image/jpeg";
        if(b.length>=8 && new String(b,0,5,java.nio.charset.StandardCharsets.US_ASCII).equals("%PDF-") &&
                new String(b,Math.max(0,b.length-1024),Math.min(1024,b.length),java.nio.charset.StandardCharsets.US_ASCII).contains("%%EOF")) return "application/pdf";
        return null;
    }
}
