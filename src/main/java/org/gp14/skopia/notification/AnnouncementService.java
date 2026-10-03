package org.gp14.skopia.notification;

import org.gp14.skopia.model.notification.Announcement;
import org.gp14.skopia.model.user.Administrator;
import org.gp14.skopia.model.user.ContentCreator;
import org.gp14.skopia.model.user.User;
import org.gp14.skopia.model.user.RegisteredViewer;
import org.gp14.skopia.repository.AnnouncementRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
public class AnnouncementService {
    public record View(Long id, String title, String body, String audience, String status, LocalDateTime publishDate, LocalDateTime createdAt, LocalDateTime updatedAt, Long publisherId, String publisherUsername) {}
    public record Input(String title, String body, String audience) {}
    private final AnnouncementRepository announcements;
    public AnnouncementService(AnnouncementRepository announcements) { this.announcements = announcements; }

    @Transactional(readOnly = true)
    public List<View> visible(User user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return announcements.findByStatusOrderByPublishDateDesc("PUBLISHED").stream().filter(a -> applicable(a, user)).map(this::view).toList();
    }
    @Transactional(readOnly = true) public List<View> adminList() { return announcements.findAllByOrderByCreatedAtDesc().stream().map(this::view).toList(); }
    @Transactional public View create(User actor, Input input) {
        Administrator admin = admin(actor); Announcement a = new Announcement(); a.setPublishedBy(admin); apply(a, input); return view(announcements.save(a));
    }
    @Transactional public View edit(User actor, Long id, Input input) {
        admin(actor); Announcement a = get(id); if (!"DRAFT".equals(a.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only drafts can be edited"); apply(a, input); return view(a);
    }
    @Transactional public View publish(User actor, Long id) {
        admin(actor); Announcement a = get(id); if (!"DRAFT".equals(a.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only drafts can be published"); a.setStatus("PUBLISHED"); a.setPublishDate(LocalDateTime.now()); return view(a);
    }
    @Transactional public View archive(User actor, Long id) {
        admin(actor); Announcement a = get(id); if ("ARCHIVED".equals(a.getStatus())) return view(a); a.setStatus("ARCHIVED"); return view(a);
    }
    private void apply(Announcement a, Input i) {
        if (i == null || i.title() == null || i.title().trim().isEmpty() || i.title().trim().length() > 255) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title must contain 1 to 255 characters");
        if (i.body() == null || i.body().trim().isEmpty() || i.body().trim().length() > 5000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body must contain 1 to 5000 characters");
        String audience = i.audience() == null ? "ALL" : i.audience().trim().toUpperCase(Locale.ROOT);
        if (!List.of("ALL","VIEWERS","CREATORS").contains(audience)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported audience");
        a.setAnnTitle(i.title().trim()); a.setAnnBody(i.body().trim()); a.setAudience(audience);
    }
    private boolean applicable(Announcement a, User u) { return "ALL".equals(a.getAudience()) || ("VIEWERS".equals(a.getAudience()) && u instanceof RegisteredViewer) || ("CREATORS".equals(a.getAudience()) && u instanceof ContentCreator); }
    private Announcement get(Long id) { return announcements.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); }
    private Administrator admin(User u) { if (!(u instanceof Administrator a)) throw new ResponseStatusException(u == null ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN); return a; }
    private View view(Announcement a) { return new View(a.getId(), a.getAnnTitle(), a.getAnnBody(), a.getAudience(), a.getStatus(), a.getPublishDate(), a.getCreatedAt(), a.getUpdatedAt(), a.getPublishedBy().getId(), a.getPublishedBy().getUsername()); }
}
