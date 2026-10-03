package org.gp14.skopia.notification;

import org.gp14.skopia.model.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;

@RestController @RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService service;
    public NotificationController(NotificationService service) { this.service = service; }
    @GetMapping public List<NotificationService.View> list(@AuthenticationPrincipal User user) { return service.list(id(user)); }
    @GetMapping("/unread-count") public Map<String,Long> unread(@AuthenticationPrincipal User user) { return Map.of("count", service.unread(id(user))); }
    @PostMapping("/{notificationId}/read") public NotificationService.View read(@AuthenticationPrincipal User user, @PathVariable Long notificationId) { return service.markRead(id(user), notificationId); }
    @PostMapping("/read-all") @ResponseStatus(HttpStatus.NO_CONTENT) public void all(@AuthenticationPrincipal User user) { service.markAllRead(id(user)); }
    private Long id(User user) { if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED); return user.getId(); }
}
